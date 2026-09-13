"use client";

import { getCaseResponseSchema, type GetCaseResponse } from "@rectify/core";
import { useContract } from "@/lib/api/use-contract";
import { ContractView } from "@/components/workspace/contract-view";
import { ApprovalPreview } from "./approval-preview";
import { CaseCommands } from "./case-commands";
import { CaseHeader } from "./case-header";
import { CaseTimeline } from "./case-timeline";
import { StatusCards } from "./status-cards";
import { UncertainActions } from "./uncertain-actions";

export function CaseWorkspace({ caseId }: { caseId: string }) {
  const { result, refresh } = useContract(
    `/api/cases/${encodeURIComponent(caseId)}`,
    getCaseResponseSchema,
  );

  return (
    <ContractView result={result} label="Case">
      {(data) => <CaseDetail data={data} onChanged={refresh} />}
    </ContractView>
  );
}

function CaseDetail({ data, onChanged }: { data: GetCaseResponse; onChanged: () => void }) {
  const latestVerification = data.verifications.find(
    (record) => record.id === data.case.latestVerificationId,
  );

  return (
    <div className="flex flex-col gap-6">
      <CaseHeader data={data} latestVerification={latestVerification} />
      <StatusCards record={data.case} latestVerification={latestVerification} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CaseTimeline data={data} />
        </div>
        <div className="flex flex-col gap-6">
          <CaseCommands record={data.case} onChanged={onChanged} />
          <UncertainActions actions={data.actions} />
          <ApprovalPreview approvals={data.approvals} />
        </div>
      </div>
    </div>
  );
}
