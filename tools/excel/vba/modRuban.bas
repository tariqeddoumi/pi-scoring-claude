Attribute VB_Name = "modRuban"
Option Explicit
'=====================================================================
' modRuban - onglet de ruban "Scoring PI" (fichier .xlsm)
' Le ruban (customUI14.xml du classeur) appelle Ruban_Action avec l'identifiant
' du bouton clique. Sans ruban : Alt+F8 et choisir la macro.
'=====================================================================

Public Sub Ruban_Action(control As IRibbonControl)
    ExecuterAction control.ID
End Sub

Public Sub ExecuterAction(ByVal id As String)
    Select Case id
        Case "btnNouveau": NouveauDossier
        Case "btnEnregistrer": EnregistrerDossier
        Case "btnOuvrir": OuvrirDossier
        Case "btnPdf": ExporterPDF
        Case "btnFiche": ThisWorkbook.Worksheets("Fiche").Activate
        Case "btnSaisie": ThisWorkbook.Worksheets("Saisie").Activate
        Case "btnStress": LancerStress
        Case "btnPortefeuille": ScorerPortefeuille
        Case "btnJournal": ScorerDossier
        Case "btnTests": ExecuterAutotests
        Case "btnValider": ValiderModele
        Case "btnParam": BasculerParametres
        Case "btnListes": RafraichirListes
        Case "btnSnap": SnapshotModele
        Case "btnAide": AfficherAide
        Case "btnAccueil": AfficherAccueil
    End Select
End Sub
