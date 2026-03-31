import path from "node:path";
import {
  GOVERNANCE_CLAIM_RULE,
  GOVERNANCE_PROOF_MANIFEST_PATH,
  GOVERNANCE_RUN_MODE_SYNC_AND_VERIFY,
  GOVERNANCE_SOT_PROOF_FILES,
  createGovernancePipeline,
  createGovernanceReportBase,
  normalizeGovernanceRunMode
} from "../../../app/src/kernel/GovernanceEngine.js";
import {
  assertFreshGitMetadata,
  assertPipelineContract,
  gitRequiredValue,
  parseRequestedRunMode
} from "./required-checks/runtime-metadata.mjs";
import {
  buildContractHash,
  buildEvidenceSummary,
  buildSotHashes,
  writeProofManifest,
  writeReport
} from "./required-checks/runtime-proof.mjs";
import {
  digestText,
  runInternalNodeScript,
  runStep,
  sha256File,
  toSyntheticVerifyStep
} from "./required-checks/runtime-execution.mjs";

const root = process.cwd();
const reportPath = path.join(root, "runtime", "evidence", "required-check-report.json");
const findingsEvidenceRel = "runtime/evidence/governance-findings.json";
const coverageEvidenceRel = "runtime/evidence/governance-coverage.json";

async function main() {
  const startedAt = new Date().toISOString();
  const runMode = parseRequestedRunMode(process.argv.slice(2));
  const normalizedRunMode = normalizeGovernanceRunMode(runMode);
  const explicitSyncMode = normalizedRunMode === GOVERNANCE_RUN_MODE_SYNC_AND_VERIFY;
  const head = gitRequiredValue(root, ["rev-parse", "HEAD"], "head");
  const branch = gitRequiredValue(root, ["branch", "--show-current"], "branch");
  assertFreshGitMetadata({ head, branch });

  const report = createGovernanceReportBase({
    runMode: normalizedRunMode,
    repo: {
      head,
      branch
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    startedAt
  });

  const pipeline = createGovernancePipeline({ runMode: normalizedRunMode });
  assertPipelineContract(normalizedRunMode, pipeline);

  report.execution = {
    total_steps: pipeline.length,
    sync_steps: pipeline.filter((item) => item.type === "sync").map((item) => item.id),
    verify_steps: pipeline.filter((item) => item.type === "verify").map((item) => item.id),
    run_mode: normalizedRunMode,
    step_contract:
      explicitSyncMode
        ? "sync (explicit) -> verify (mandatory) -> post_verify (explicit)"
        : "verify (mandatory) only; sync/materialize disabled"
  };
  report.contract_hash = await buildContractHash({ report, pipeline });

  try {
    for (const step of pipeline) {
      const gate = await runStep(root, step);
      report.steps.push(gate);
    }

    report.overall_status = "PASSED";
    await writeReport(reportPath, report, explicitSyncMode);

    if (explicitSyncMode) {
      const findingsStep = await runInternalNodeScript(root, "dev/tools/runtime/governance-findings-materialize.mjs", [
        "--report",
        "runtime/evidence/required-check-report.json"
      ]);
      const findingsVerify = await runInternalNodeScript(
        root,
        "dev/tools/runtime/governance-findings-verify.mjs",
        [],
        { RUNTIME_VERIFY_READ_ONLY: "1" }
      );
      report.steps.push(toSyntheticVerifyStep(findingsVerify, "governance:findings:verify"));
      report.findings = {
        materialized: {
          script: findingsStep.script,
          output_sha256: findingsStep.output_sha256
        },
        verify: {
          script: findingsVerify.script,
          output_sha256: findingsVerify.output_sha256
        }
      };
    }

    if (explicitSyncMode) {
      const evidenceSummary = await buildEvidenceSummary(root, sha256File);
      const sotHashes = await buildSotHashes(root, GOVERNANCE_SOT_PROOF_FILES, sha256File);
      const manifestRef = await writeProofManifest({
        root,
        report,
        evidenceSummary,
        sotHashes,
        findingsEvidenceRel,
        coverageRel: coverageEvidenceRel,
        proofManifestPath: GOVERNANCE_PROOF_MANIFEST_PATH,
        claimRule: GOVERNANCE_CLAIM_RULE,
        sha256File
      });
      report.proof = {
        ...evidenceSummary,
        sot: sotHashes,
        manifest: manifestRef
      };
      report.claim_rule = GOVERNANCE_CLAIM_RULE;
      report.overall_status = "PASSED";
      report.finished_at = new Date().toISOString();
      await writeReport(reportPath, report, true);
      console.log(
        `[REQUIRED_CHECK] PASS mode=${report.run_mode} proof=${report.proof.final_testline_summary.sha256.slice(0, 12)}`
      );
      console.log(
        `[REQUIRED_CHECK][PROOF] manifest=${manifestRef.sha256.slice(0, 12)} evidence=${report.proof.evidence_summary.sha256.slice(0, 12)} sot=${sotHashes.length}`
      );
    } else {
      report.finished_at = new Date().toISOString();
      const stepDigest = digestText(report.steps.map((step) => `${step.id}:${step.output_sha256}`).join("|")).slice(0, 12);
      console.log(`[REQUIRED_CHECK] PASS mode=${report.run_mode} proof=${stepDigest}`);
    }
  } catch (failedStep) {
    report.overall_status = "FAILED";
    report.steps.push(failedStep);
    report.failure_step = failedStep.id || failedStep.script || "unknown";
    await writeReport(reportPath, report, explicitSyncMode);

    if (explicitSyncMode) {
      try {
        const findingsStep = await runInternalNodeScript(root, "dev/tools/runtime/governance-findings-materialize.mjs", [
          "--report",
          "runtime/evidence/required-check-report.json"
        ]);
        let findingsVerify = null;
        try {
          findingsVerify = await runInternalNodeScript(
            root,
            "dev/tools/runtime/governance-findings-verify.mjs",
            [],
            { RUNTIME_VERIFY_READ_ONLY: "1" }
          );
          report.steps.push(toSyntheticVerifyStep(findingsVerify, "governance:findings:verify"));
        } catch (verifyError) {
          report.steps.push(toSyntheticVerifyStep(verifyError, "governance:findings:verify"));
          findingsVerify = null;
        }
        report.findings = {
          materialized: {
            script: findingsStep.script,
            output_sha256: findingsStep.output_sha256
          },
          verify: findingsVerify
            ? {
                script: findingsVerify.script,
                output_sha256: findingsVerify.output_sha256
              }
            : null
        };
      } catch (findingError) {
        report.findings = {
          materialized: {
            script: findingError.script || "dev/tools/runtime/governance-findings-materialize.mjs",
            output_sha256: findingError.output_sha256 || digestText(String(findingError?.error || "materialize failed")),
            status: "FAILED"
          }
        };
      }
    }

    report.finished_at = new Date().toISOString();
    await writeReport(reportPath, report, explicitSyncMode);
    console.error(`[REQUIRED_CHECK] BLOCK step=${report.failure_step}`);
    process.exit(1);
  }
}

await main();
