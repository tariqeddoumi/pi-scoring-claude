# Sources des guides (Word et PowerPoint)

| Fichier | Rôle |
|---|---|
| `export_guide_data.ts` | Exporte du code et du modèle publié les faits du guide : libellés d'écran, étapes du wizard, barèmes, données décisionnelles, alertes, événements, périodicités de revue, circuit et rôles → `guide_data.json` |
| `guide_content.js` | Contenu métier : pièces justificatives (P01 à P33), méthode de calcul et points d'attention pour chaque donnée |
| `gen_guide_docx.js` | Génère `docs/Guide_Charge_Affaires_Promotion_Immobiliere.docx` |
| `gen_guide_pptx.js` | Génère `docs/Guide_Charge_Affaires_Formation.pptx` |

Régénération (depuis la racine du dépôt) :

```bash
npx tsx docs/_sources/export_guide_data.ts
node docs/_sources/gen_guide_docx.js
# le support PowerPoint utilise pptxgenjs, react-icons, react, react-dom et sharp,
# installés dans un dossier séparé pour ne pas modifier les dépendances de l'application :
#   mkdir /tmp/pptx && cd /tmp/pptx && npm init -y && npm i pptxgenjs react-icons react react-dom sharp
PPTX_DEPS=/tmp/pptx/node_modules node docs/_sources/gen_guide_pptx.js
```

Après une nouvelle publication du modèle, relancer l'export : les libellés,
barèmes et données décisionnelles des guides suivent automatiquement. Le
contenu de `guide_content.js` (pièces, calculs) est à relire si un critère est
ajouté — une clé sans entrée y apparaît avec des colonnes vides.
