Attribute VB_Name = "modSetup"
Option Explicit
'=====================================================================
' modSetup - boutons sur les feuilles (alternative au ruban "Scoring PI")
' Utile seulement si les modules ont ete importes dans le .xlsx : le fichier
' .xlsm fourni contient deja l'onglet de ruban. A executer une fois : InstallerBoutons
'=====================================================================

Private mEchecs As String

' Ajoute (ou remplace) un bouton de formulaire ; un echec n'interrompt pas l'installation.
Private Sub AjouterBouton(ByVal nomFeuille As String, ByVal ancre As String, ByVal nomBouton As String, _
                          ByVal texte As String, ByVal macro As String, ByVal largeur As Double)
    Dim ws As Worksheet
    Dim b As Object
    On Error GoTo Echec
    Set ws = ThisWorkbook.Worksheets(nomFeuille)
    Deproteger ws
    On Error Resume Next
    ws.Buttons(nomBouton).Delete
    On Error GoTo Echec
    Set b = ws.Buttons.Add(ws.Range(ancre).Left, ws.Range(ancre).Top, largeur, 24)
    b.Name = nomBouton
    b.Caption = texte
    b.OnAction = macro
    ReprotegerSiBesoin ws
    Exit Sub
Echec:
    mEchecs = mEchecs & vbCrLf & " - " & nomFeuille & " : " & texte & " (" & Err.Description & ")"
    ReprotegerSiBesoin ws
End Sub

' Les feuilles de travail (Accueil, Saisie, Fiche, Calculateurs, Resultat) restent protegees.
Private Sub ReprotegerSiBesoin(ByVal ws As Worksheet)
    If ws Is Nothing Then Exit Sub
    Select Case ws.Name
        Case "Accueil", "Saisie", "Fiche", "Calculateurs", "Resultat"
            Proteger ws
    End Select
End Sub

Public Sub InstallerBoutons()
    mEchecs = ""
    AjouterBouton "Accueil", "D4", "btnNouveau", "Nouveau dossier", "NouveauDossier", 170
    AjouterBouton "Accueil", "D6", "btnEnregistrer", "Enregistrer le dossier", "EnregistrerDossier", 170
    AjouterBouton "Accueil", "D8", "btnOuvrir", "Ouvrir un dossier", "OuvrirDossier", 170
    AjouterBouton "Accueil", "D10", "btnPdf", FR("Exporter la fiche en PDF"), "ExporterPDF", 170
    AjouterBouton "Accueil", "D14", "btnStress", "Stress test", "LancerStress", 170
    AjouterBouton "Accueil", "D16", "btnPortefeuille", "Scorer le portefeuille", "ScorerPortefeuille", 170
    AjouterBouton "Accueil", "D18", "btnParam", FR("Param~etres (afficher / masquer)"), "BasculerParametres", 170
    AjouterBouton "Portefeuille", "H1", "btnPortefeuille", "Scorer le portefeuille", "ScorerPortefeuille", 170
    AjouterBouton "Portefeuille", "K1", "btnOuvrirP", FR("Ouvrir le dossier s~electionn~e"), "OuvrirDossier", 190
    AjouterBouton "Stress", "N3", "btnStress2", "Lancer le stress test", "LancerStress", 150
    AjouterBouton "Tests", "H1", "btnTests", FR("Ex~ecuter les autotests"), "ExecuterAutotests", 170
    AjouterBouton "P_General", "G3", "btnValider", FR("Valider le mod~ele"), "ValiderModele", 150
    AjouterBouton "P_General", "G5", "btnSnap", FR("Instantan~e du mod~ele"), "SnapshotModele", 150
    AjouterBouton "P_General", "G7", "btnListes", FR("Rafra~ichir les listes"), "RafraichirListes", 150
    If Len(mEchecs) > 0 Then
        MsgBox FR("Boutons install~es, sauf :") & mEchecs & vbCrLf & vbCrLf & _
               FR("Les macros restent accessibles par Alt+F8."), vbExclamation, "Installation"
    Else
        MsgBox FR("Boutons install~es. Enregistrez maintenant le classeur au format .xlsm (Classeur Excel prenant en charge les macros)."), vbInformation, "Installation"
    End If
End Sub
