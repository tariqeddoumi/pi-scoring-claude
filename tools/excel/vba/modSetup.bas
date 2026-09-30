Attribute VB_Name = "modSetup"
Option Explicit
'=====================================================================
' modSetup - installation des boutons et export PDF
' A executer une seule fois apres l'import des modules : InstallerBoutons
'=====================================================================

Private mEchecs As String

' Ajoute (ou remplace) un bouton de formulaire ; un echec n'interrompt pas l'installation.
Private Sub AjouterBouton(ByVal nomFeuille As String, ByVal ancre As String, ByVal nomBouton As String, _
                          ByVal texte As String, ByVal macro As String, ByVal largeur As Double)
    Dim ws As Worksheet
    Dim b As Object
    On Error GoTo Echec
    Set ws = ThisWorkbook.Worksheets(nomFeuille)
    On Error Resume Next
    ws.Buttons(nomBouton).Delete
    On Error GoTo Echec
    Set b = ws.Buttons.Add(ws.Range(ancre).Left, ws.Range(ancre).Top, largeur, 24)
    b.Name = nomBouton
    b.Caption = texte
    b.OnAction = macro
    Exit Sub
Echec:
    mEchecs = mEchecs & vbCrLf & " - " & nomFeuille & " : " & texte & " (" & Err.Description & ")"
End Sub

Public Sub InstallerBoutons()
    mEchecs = ""
    AjouterBouton "Saisie", "J2", "btnNouveau", "Nouveau dossier (vider)", "NouveauDossier", 150
    AjouterBouton "Saisie", "J4", "btnScorer", "Calculer et journaliser", "ScorerDossier", 150
    AjouterBouton "Saisie", "J6", "btnStress", "Lancer le stress test", "LancerStress", 150
    AjouterBouton "Saisie", "J8", "btnPdf", "Exporter en PDF", "ExporterPDF", 150
    AjouterBouton "Resultat", "J2", "btnPdfRes", "Exporter en PDF", "ExporterPDF", 150
    AjouterBouton "Portefeuille", "H1", "btnPortefeuille", "Scorer le portefeuille", "ScorerPortefeuille", 170
    AjouterBouton "Stress", "N3", "btnStress2", "Lancer le stress test", "LancerStress", 150
    AjouterBouton "Tests", "H1", "btnTests", "Executer les autotests", "ExecuterAutotests", 170
    AjouterBouton "P_General", "E3", "btnValider", "Valider le modele", "ValiderModele", 150
    AjouterBouton "P_General", "E5", "btnSnap", "Instantane du modele", "SnapshotModele", 150
    AjouterBouton "P_General", "E7", "btnListes", "Rafraichir les listes", "RafraichirListes", 150
    If Len(mEchecs) > 0 Then
        MsgBox "Boutons installes, sauf :" & mEchecs & vbCrLf & vbCrLf & _
               "Les macros restent accessibles par Alt+F8.", vbExclamation, "Installation"
    Else
        MsgBox "Boutons installes. Enregistrez maintenant le classeur au format .xlsm (Classeur Excel prenant en charge les macros).", vbInformation, "Installation"
    End If
End Sub

' Exporte l'onglet Resultat (synthese + domaines) en PDF.
Public Sub ExporterPDF()
    Dim ws As Worksheet
    Dim chemin As String, ref As String, fichier As String
    Set ws = ThisWorkbook.Worksheets("Resultat")
    Application.Calculate
    ref = CStr(ThisWorkbook.Worksheets("Saisie").Range("C4").Value)
    If Len(ref) = 0 Then ref = "dossier"
    ref = Replace(Replace(Replace(ref, "/", "-"), "\", "-"), ":", "-")
    chemin = ThisWorkbook.Path
    If Len(chemin) = 0 Then chemin = Environ("TEMP")
    If Len(chemin) = 0 Then chemin = Application.DefaultFilePath
    fichier = chemin & SepChemin() & "Score_" & ref & "_" & Format(Now, "yyyymmdd_hhmm") & ".pdf"
    With ws.PageSetup
        .PrintArea = "$A$1:$H$40"
        .Orientation = xlLandscape
        .Zoom = False
        .FitToPagesWide = 1
        .FitToPagesTall = 1
    End With
    ws.ExportAsFixedFormat Type:=xlTypePDF, Filename:=fichier, Quality:=xlQualityStandard, OpenAfterPublish:=False
    MsgBox "PDF enregistre :" & vbCrLf & fichier, vbInformation, "Export"
End Sub
