Attribute VB_Name = "modDossier"
Option Explicit
'=====================================================================
' modDossier - gestion des dossiers (outil 5.1)
' Enregistrer le dossier courant dans le Portefeuille, rouvrir un dossier,
' exporter la fiche en PDF, afficher / masquer les parametres, aide.
' Le Portefeuille garde les VALEURS UTILISEES (y compris celles calculees par
' les calculateurs) : un dossier rouvert donne exactement le meme resultat.
'=====================================================================

' Ligne du Portefeuille portant la reference donnee (0 si absente).
Public Function LigneDossier(ByVal ref As String) As Long
    Dim ws As Worksheet
    Dim r As Long, dern As Long
    LigneDossier = 0
    If Len(Trim$(ref)) = 0 Then Exit Function
    Set ws = ThisWorkbook.Worksheets("Portefeuille")
    dern = DerniereLigne(ws, 1)
    For r = 5 To dern
        If StrComp(Trim$(CStr(ws.Cells(r, 1).Value)), Trim$(ref), vbTextCompare) = 0 Then
            LigneDossier = r
            Exit Function
        End If
    Next r
End Function

' Ecrit le dossier courant (identite, valeurs utilisees, resultat) sur une ligne du Portefeuille.
Public Sub EcrireDossierLigne(ByVal r As Long)
    Dim ws As Worksheet, wsS As Worksheet
    Dim nCles As Long, j As Long, p As Long
    Dim cle As String
    Dim v As Variant
    Set ws = ThisWorkbook.Worksheets("Portefeuille")
    Set wsS = ThisWorkbook.Worksheets("Saisie")
    nCles = CompterCles(ws)
    Application.Calculate
    ws.Cells(r, 1).Value = wsS.Range("C4").Value
    ws.Cells(r, 2).Value = wsS.Range("C5").Value
    PoserValeur ws.Cells(r, 3), wsS.Range("D6").Value      ' code du segment
    PoserValeur ws.Cells(r, 4), wsS.Range("D7").Value      ' code de la zone
    PoserValeur ws.Cells(r, 5), wsS.Range("C8").Value
    For j = 1 To nCles
        cle = CStr(ws.Cells(4, 5 + j).Value)
        p = PosCle(cle)
        If p > 0 Then
            v = NomPlage("In_Retenue").Cells(p, 1).Value
            If VarType(v) = vbBoolean Then
                If v Then
                    ws.Cells(r, 5 + j).Value = "Oui"
                Else
                    ws.Cells(r, 5 + j).Value = "Non"
                End If
            Else
                PoserValeur ws.Cells(r, 5 + j), v
            End If
        End If
    Next j
    EcrireResultat ws, r, 6 + nCles, LireResultat()
End Sub

' Ruban : Enregistrer le dossier (ajoute ou met a jour sa ligne dans le Portefeuille).
Public Sub EnregistrerDossier()
    Dim ref As String
    Dim r As Long
    ref = Trim$(CStr(ThisWorkbook.Worksheets("Saisie").Range("C4").Value))
    If Len(ref) = 0 Then
        MsgBox FR("Renseignez d'abord la r~ef~erence du dossier (onglet Saisie, cellule C4)."), vbExclamation, "Enregistrer le dossier"
        ThisWorkbook.Worksheets("Saisie").Activate
        ThisWorkbook.Worksheets("Saisie").Range("C4").Select
        Exit Sub
    End If
    r = LigneDossier(ref)
    If r > 0 Then
        If MsgBox(FR("Le dossier ~<") & ref & FR("~> existe d~ej~a dans le portefeuille (ligne ") & r & ")." & vbCrLf & _
                  FR("Le mettre ~a jour avec la saisie en cours ?"), vbYesNo + vbQuestion, "Enregistrer le dossier") <> vbYes Then Exit Sub
    Else
        r = PremiereLigneLibre()
    End If
    EcrireDossierLigne r
    Journaliser ref, LireResultat()
    MsgBox FR("Dossier ~<") & ref & FR("~> enregistr~e dans le portefeuille (ligne ") & r & ")." & vbCrLf & _
           FR("D~ecision : ") & LibelleDecision(NomPlage("Res_Decision").Value) & " - score " & Format(NomPlage("Res_ScoreFinal").Value, "0.00"), _
           vbInformation, "Enregistrer le dossier"
End Sub

Private Function PremiereLigneLibre() As Long
    Dim ws As Worksheet
    Dim r As Long
    Set ws = ThisWorkbook.Worksheets("Portefeuille")
    r = DerniereLigne(ws, 1) + 1
    If r < 5 Then r = 5
    PremiereLigneLibre = r
End Function

' Ruban : Ouvrir un dossier. Ligne selectionnee dans le Portefeuille, sinon reference demandee.
Public Sub OuvrirDossier()
    Dim ws As Worksheet
    Dim ref As String
    Dim r As Long
    Set ws = ThisWorkbook.Worksheets("Portefeuille")
    If ActiveSheet.Name = ws.Name And ActiveCell.Row >= 5 Then
        ref = Trim$(CStr(ws.Cells(ActiveCell.Row, 1).Value))
    End If
    If Len(ref) = 0 Then
        ref = Trim$(InputBox(FR("R~ef~erence du dossier ~a ouvrir (colonne A du Portefeuille) :"), "Ouvrir un dossier"))
        If Len(ref) = 0 Then Exit Sub
    End If
    r = LigneDossier(ref)
    If r = 0 Then
        MsgBox FR("Aucun dossier ~<") & ref & FR("~> dans le portefeuille."), vbExclamation, "Ouvrir un dossier"
        Exit Sub
    End If
    If Len(CStr(ThisWorkbook.Worksheets("Saisie").Range("C4").Value)) > 0 Then
        If MsgBox(FR("Le dossier en cours (saisie et calculateurs) sera remplac~e par ~<") & ref & FR("~>.") & vbCrLf & _
                  FR("Pensez ~a l'enregistrer d'abord si n~ecessaire. Continuer ?"), vbYesNo + vbQuestion, "Ouvrir un dossier") <> vbYes Then Exit Sub
    End If
    OuvrirLigne r
    ThisWorkbook.Worksheets("Saisie").Activate
    ThisWorkbook.Worksheets("Saisie").Range("C4").Select
    MsgBox FR("Dossier ~<") & ref & FR("~> ouvert. D~ecision : ") & LibelleDecision(NomPlage("Res_Decision").Value) & _
           " - score " & Format(NomPlage("Res_ScoreFinal").Value, "0.00"), vbInformation, "Ouvrir un dossier"
End Sub

' Charge une ligne du Portefeuille dans la Saisie (sans confirmation) : saisie et calculateurs
' du dossier courant d'abord vides ; modalites, segment et zone affiches en clair.
Public Sub OuvrirLigne(ByVal r As Long)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Portefeuille")
    ViderDossier
    ChargerLigne ws, r, CompterCles(ws)
    AfficherEnClair
    Application.Calculate
End Sub

' Remplace les codes techniques de la Saisie par leur libelle en clair (meme valeur pour le moteur).
Public Sub AfficherEnClair()
    Dim wsS As Worksheet
    Dim r As Long
    Dim libelle As String
    Set wsS = ThisWorkbook.Worksheets("Saisie")
    libelle = LibelleTable(NomPlage("P_SegCodes"), NomPlage("P_SegLabelsAll"), CStr(wsS.Range("C6").Value))
    If Len(libelle) > 0 Then wsS.Range("C6").Value = libelle
    libelle = LibelleTable(NomPlage("P_ZoneCodes"), NomPlage("P_ZoneLabelsAll"), CStr(wsS.Range("C7").Value))
    If Len(libelle) > 0 Then wsS.Range("C7").Value = libelle
    For r = 13 To 92
        If CStr(wsS.Cells(r, 4).Value) = "QUAL" And Len(CStr(wsS.Cells(r, 5).Value)) > 0 Then
            libelle = LibelleModalite(CStr(wsS.Cells(r, 2).Value), CStr(wsS.Cells(r, 5).Value))
            If Len(libelle) > 0 Then wsS.Cells(r, 5).Value = libelle
        End If
    Next r
End Sub

Private Function LibelleTable(ByVal codes As Range, ByVal libs As Range, ByVal code As String) As String
    Dim i As Long
    LibelleTable = ""
    If Len(code) = 0 Then Exit Function
    For i = 1 To codes.Rows.Count
        If CStr(codes.Cells(i, 1).Value) = code Then
            LibelleTable = CStr(libs.Cells(i, 1).Value)
            Exit Function
        End If
    Next i
End Function

' Libelle d'une modalite : barremes du critere (P_Baremes) ou modalites des donnees d'alerte.
Public Function LibelleModalite(ByVal cle As String, ByVal code As String) As String
    Dim wsK As Worksheet, wsB As Worksheet
    Dim k As Long, b As Long
    Dim crit As String
    LibelleModalite = ""
    Set wsK = ThisWorkbook.Worksheets("P_Criteres")
    Set wsB = ThisWorkbook.Worksheets("P_Baremes")
    For k = 5 To 64
        If CStr(wsK.Cells(k, 6).Value) = cle Then crit = CStr(wsK.Cells(k, 1).Value)
    Next k
    If Len(crit) > 0 Then
        For b = 5 To 400
            If CStr(wsB.Cells(b, 1).Value) = crit And CStr(wsB.Cells(b, 2).Value) = "MODALITE" And CStr(wsB.Cells(b, 3).Value) = code Then
                LibelleModalite = CStr(wsB.Cells(b, 6).Value)
                Exit Function
            End If
        Next b
    Else
        Dim i As Long
        For i = 1 To NomPlage("R_ModKey").Rows.Count
            If CStr(NomPlage("R_ModKey").Cells(i, 1).Value) = cle And CStr(NomPlage("R_ModCode").Cells(i, 1).Value) = code Then
                LibelleModalite = CStr(NomPlage("R_ModLab").Cells(i, 1).Value)
                Exit Function
            End If
        Next i
    End If
End Function

' Ruban : Exporter la fiche de resultat en PDF (une page, a cote du classeur).
Public Sub ExporterPDF()
    Dim ws As Worksheet
    Dim chemin As String, ref As String, fichier As String
    Set ws = ThisWorkbook.Worksheets("Fiche")
    Application.Calculate
    ref = CStr(ThisWorkbook.Worksheets("Saisie").Range("C4").Value)
    If Len(ref) = 0 Then ref = "dossier"
    ref = Replace(Replace(Replace(Replace(Replace(ref, "/", "-"), "\", "-"), ":", "-"), "*", "-"), "?", "-")
    chemin = ThisWorkbook.Path
    If Len(chemin) = 0 Then chemin = Environ("TEMP")
    If Len(chemin) = 0 Then chemin = Application.DefaultFilePath
    fichier = chemin & SepChemin() & "Fiche_" & ref & "_" & Format(Now, "yyyymmdd_hhmm") & ".pdf"
    ws.ExportAsFixedFormat Type:=xlTypePDF, Filename:=fichier, Quality:=xlQualityStandard, _
                           IgnorePrintAreas:=False, OpenAfterPublish:=True
    MsgBox FR("Fiche enregistr~ee :") & vbCrLf & fichier, vbInformation, "Export PDF"
End Sub

' Ruban : Parametres - affiche ou masque les onglets du modele (P_*) et des cas de reference.
Public Sub BasculerParametres()
    Dim noms As Variant
    Dim i As Long
    Dim afficher As Boolean
    noms = Array("P_General", "P_Criteres", "P_Baremes", "P_Alertes", "P_Ajustements", "P_Referentiels", "Tests")
    afficher = (ThisWorkbook.Worksheets("P_General").Visible <> xlSheetVisible)
    For i = LBound(noms) To UBound(noms)
        If afficher Then
            ThisWorkbook.Worksheets(CStr(noms(i))).Visible = xlSheetVisible
        Else
            ThisWorkbook.Worksheets(CStr(noms(i))).Visible = xlSheetHidden
        End If
    Next i
    If afficher Then
        ThisWorkbook.Worksheets("P_General").Activate
        MsgBox FR("Param~etres du mod~ele affich~es (onglets P_*). Toute modification : Valider le mod~ele, puis informer le propri~etaire du mod~ele."), vbInformation, FR("Param~etres")
    Else
        ThisWorkbook.Worksheets("Accueil").Activate
    End If
End Sub

Public Sub AfficherAide()
    ThisWorkbook.Worksheets("Aide").Activate
End Sub

Public Sub AfficherAccueil()
    ThisWorkbook.Worksheets("Accueil").Activate
End Sub
