// =====================================================================
//  nextAction.ts — Guide « Que faire maintenant ? » : l'action suivante la
//  plus utile pour l'utilisateur courant, selon l'étape du circuit, son rôle,
//  la fraîcheur du score et la complétude de la saisie. Rend l'outil
//  auto-porteur pour les centres d'affaires et la contre-étude, sans
//  connaître le circuit par cœur. Logique PURE et testable.
// =====================================================================

import { hasPermission, PERMISSIONS, type RoleName } from "@/lib/rbac";
import type { WorkflowStateName } from "@/lib/workflow";

export interface NextActionInput {
  state: WorkflowStateName;
  role: RoleName;
  /** Le score doit être recalculé (revue périodique / événement matériel). */
  needsRescoring?: boolean;
  /** Complétude de la saisie (0..100), si connue. */
  completenessPct?: number | null;
  /** Un scoring a déjà été exécuté. */
  hasScore?: boolean;
}

export interface NextAction {
  /** Action à mener (impératif court) — ou attente. */
  title: string;
  description: string;
  /** Cible de navigation relative à la fiche : "scoring" | "suivi" | null (fiche). */
  target: "scoring" | "suivi" | null;
  /** L'utilisateur courant est acteur de cette étape (sinon simple attente). */
  actionable: boolean;
}

export function nextActionFor(i: NextActionInput): NextAction {
  const can = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) => hasPermission(i.role, p);
  const wait = (description: string): NextAction => ({
    title: "En attente",
    description,
    target: null,
    actionable: false,
  });

  switch (i.state) {
    case "DRAFT": {
      if (!can(PERMISSIONS.PROJECT_WRITE)) return wait("Dossier en cours de constitution par le chargé d'affaires.");
      if (i.completenessPct != null && i.completenessPct < 100) {
        return {
          title: "Compléter la saisie",
          description: `Dossier renseigné à ${i.completenessPct} % — complétez le wizard de scoring puis calculez un premier score avant de soumettre.`,
          target: "scoring",
          actionable: true,
        };
      }
      if (!i.hasScore) {
        return {
          title: "Calculer le score",
          description: "La saisie est complète : lancez le scoring puis soumettez le dossier au circuit.",
          target: "scoring",
          actionable: true,
        };
      }
      return {
        title: "Soumettre le dossier",
        description: "Saisie complète et score calculé : soumettez le dossier (panneau « Circuit de décision »).",
        target: null,
        actionable: true,
      };
    }
    case "SUBMITTED": {
      if (can(PERMISSIONS.WORKFLOW_ENDORSE)) {
        return {
          title: "Prendre le dossier pour avis",
          description: "Le dossier est soumis : prenez-le pour avis de direction de centre d'affaires.",
          target: null,
          actionable: true,
        };
      }
      if (can(PERMISSIONS.SCORING_RUN)) {
        return {
          title: "Prendre en contre-étude",
          description: "Vous pouvez vous saisir directement du dossier en contre-étude.",
          target: null,
          actionable: true,
        };
      }
      return wait("En attente de l'avis du directeur de centre d'affaires ou de la contre-étude.");
    }
    case "BRANCH_REVIEW": {
      if (can(PERMISSIONS.WORKFLOW_ENDORSE)) {
        return {
          title: "Émettre votre avis",
          description: "Avis favorable → transmettez à la contre-étude ; sinon renvoyez au chargé d'affaires ou rejetez.",
          target: null,
          actionable: true,
        };
      }
      return wait("En attente de l'avis du directeur de centre d'affaires.");
    }
    case "ANALYST_REVIEW": {
      if (!can(PERMISSIONS.SCORING_RUN)) return wait("Dossier en contre-étude (validation du score).");
      if (i.needsRescoring) {
        return {
          title: "Re-scorer le dossier",
          description: "Le score n'est plus à jour (revue périodique ou événement matériel) : synchronisez le suivi puis relancez le scoring avant de valider.",
          target: "scoring",
          actionable: true,
        };
      }
      return {
        title: "Valider le score",
        description: "Contrôlez la saisie et le score ; si conforme, transmettez à la décision (sinon renvoyez au chargé d'affaires).",
        target: null,
        actionable: true,
      };
    }
    case "MANAGER_VALIDATION": {
      if (can(PERMISSIONS.SCORING_VALIDATE)) {
        return {
          title: "Décider",
          description: "Selon votre délégation : approuvez, passez en comité de crédit, ou rejetez.",
          target: null,
          actionable: true,
        };
      }
      return wait("En attente de la décision (délégation / passage en comité).");
    }
    case "COMMITTEE": {
      if (can(PERMISSIONS.SCORING_VALIDATE)) {
        return {
          title: "Enregistrer la décision du comité",
          description: "Renseignez quorum, votes et sens de la décision dans le formulaire de comité.",
          target: null,
          actionable: true,
        };
      }
      return wait("Dossier présenté en comité de crédit.");
    }
    case "APPROVED": {
      if (i.needsRescoring && can(PERMISSIONS.SCORING_RUN)) {
        return {
          title: "Re-scorer (revue régulière)",
          description: "Dossier approuvé mais score à rafraîchir : synchronisez le suivi puis relancez le scoring.",
          target: "scoring",
          actionable: true,
        };
      }
      return {
        title: "Assurer le suivi rapproché",
        description: "Dossier approuvé : tenez le journal des événements, les visites et la commercialisation à jour — le scoring se rafraîchit selon la classe.",
        target: "suivi",
        actionable: can(PERMISSIONS.PROJECT_WRITE),
      };
    }
    case "REJECTED": {
      if (can(PERMISSIONS.PROJECT_WRITE)) {
        return {
          title: "Reprendre le dossier",
          description: "Dossier rejeté : vous pouvez le reprendre en brouillon pour le retravailler.",
          target: null,
          actionable: true,
        };
      }
      return wait("Dossier rejeté.");
    }
  }
}
