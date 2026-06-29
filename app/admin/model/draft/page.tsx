import Link from "next/link";
import { getModelDraft } from "@/server/queries";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { ModelBuilderEditor, type DraftModel } from "@/components/ModelBuilderEditor";
import { CreateDraftButton } from "@/components/CreateDraftButton";

export const dynamic = "force-dynamic";

export default async function ModelDraftPage() {
  if (!(await currentUserCan(PERMISSIONS.MODEL_WRITE))) return <AccessDenied />;
  const res = await safe(() => getModelDraft());
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const draft = res.data;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/model" className="text-sm text-muted-foreground hover:underline">← Modèle publié</Link>
        <h1 className="text-2xl font-bold">Éditeur de modèle (brouillon)</h1>
        <p className="text-sm text-muted-foreground">Ajoutez, modifiez ou supprimez librement domaines, critères, modalités, barèmes et red flags. La publication remplace la version active (les scores passés sont conservés).</p>
      </div>

      {draft ? (
        <ModelBuilderEditor draft={draft as unknown as DraftModel} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Aucun brouillon en cours. Créez-en un à partir de la version publiée.</p>
          <CreateDraftButton />
        </div>
      )}
    </div>
  );
}
