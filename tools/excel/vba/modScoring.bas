Attribute VB_Name = "modScoring"
Option Explicit
'=====================================================================
' modScoring - scoring d'un dossier, d'un portefeuille, autotests, journal
'=====================================================================

' Lit le resultat courant du classeur. Tableau (0..14) :
' 0 score final, 1 decision, 2 classe interne, 3 malus D5, 4 dossier complet (Oui/Non),
' 5..8 scores D1..D4, 9 score eco., 10 note suretes, 11 PD indicative, 12 alertes,
' 13 donnees decisionnelles manquantes (libelles), 14 conditions a lever (jalon).
Public Function LireResultat() As Variant
    Dim d As Variant
    Dim complet As String
    d = NomPlage("Res_DomScores").Value2
    If EstVrai(NomPlage("Res_Incomplet").Value2) Then
        complet = "Non"
    Else
        complet = "Oui"
    End If
    LireResultat = Array( _
        NomPlage("Res_ScoreFinal").Value2, NomPlage("Res_Decision").Value2, _
        NomPlage("Res_ClasseInt").Value2, NomPlage("Res_Malus").Value2, complet, _
        d(1, 1), d(2, 1), d(3, 1), d(4, 1), _
        NomPlage("Res_ScoreEco").Value2, NomPlage("Res_GuarScore").Value2, _
        NomPlage("Res_PD").Value2, NomPlage("Res_Alertes").Value2, _
        NomPlage("Res_Manquantes").Value2, NomPlage("Res_Conditions").Value2)
End Function

' Copie une ligne (Portefeuille ou Tests) vers l'onglet Saisie.
Public Sub ChargerLigne(ByVal ws As Worksheet, ByVal r As Long, ByVal nCles As Long)
    Dim j As Long
    Dim cle As String
    Dim cel As Range
    With ThisWorkbook.Worksheets("Saisie")
        PoserValeur .Range("C4"), ws.Cells(r, 1).Value
        PoserValeur .Range("C5"), ws.Cells(r, 2).Value
        PoserValeur .Range("C6"), ws.Cells(r, 3).Value
        PoserValeur .Range("C7"), ws.Cells(r, 4).Value
        PoserValeur .Range("C8"), ws.Cells(r, 5).Value
    End With
    ' On efface d'abord toutes les saisies : une cle absente de la ligne doit rester ABSENTE.
    NomPlage("In_Saisie").ClearContents
    For j = 1 To nCles
        cle = CStr(ws.Cells(4, 5 + j).Value)
        Set cel = CelluleSaisie(cle)
        If Not (cel Is Nothing) Then PoserValeur cel, ws.Cells(r, 5 + j).Value
    Next j
End Sub

' Ajoute une ligne au journal des calculs.
Public Sub Journaliser(ByVal dossier As String, ByVal res As Variant)
    Dim ws As Worksheet
    Dim r As Long
    Set ws = ThisWorkbook.Worksheets("Historique")
    r = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
    If r < 5 Then r = 5
    ws.Cells(r, 1).Value = Now
    ws.Cells(r, 1).NumberFormat = "dd/mm/yyyy hh:mm:ss"
    ws.Cells(r, 2).Value = NomUtilisateur()
    ws.Cells(r, 3).Value = dossier
    ws.Cells(r, 4).Value = NomPlage("P_Version").Value
    ws.Cells(r, 5).Value = res(0)
    ws.Cells(r, 6).Value = res(1)
    ws.Cells(r, 7).Value = res(2)
    ws.Cells(r, 8).Value = res(3)
    ws.Cells(r, 9).Value = res(4)
End Sub

' Calcule le dossier courant de l'onglet Saisie, l'inscrit au journal et affiche le resultat.
Public Sub ScorerDossier()
    Dim res As Variant
    Application.Calculate
    res = LireResultat()
    Journaliser CStr(ThisWorkbook.Worksheets("Saisie").Range("C4").Value), res
    ThisWorkbook.Worksheets("Resultat").Activate
    Dim txt As String
    txt = "Decision : " & res(1) & vbCrLf & "Score final : " & Format(res(0), "0.00") & vbCrLf & _
          "Classe interne : " & res(2) & vbCrLf & "Malus D5 : " & res(3) & vbCrLf & _
          "Dossier complet : " & res(4)
    If Len(CStr(res(13))) > 0 Then txt = txt & vbCrLf & vbCrLf & "Donnees manquantes : " & res(13)
    If Len(CStr(res(14))) > 0 Then txt = txt & vbCrLf & vbCrLf & "Conditions : " & res(14)
    If Len(CStr(res(12))) > 0 Then txt = txt & vbCrLf & vbCrLf & "Alertes : " & res(12)
    If EstVrai(NomPlage("Res_Comite").Value2) Then txt = txt & vbCrLf & vbCrLf & "Retour en comite requis."
    MsgBox txt, vbInformation, "Scoring - modele " & CStr(NomPlage("P_Version").Value)
End Sub

' Score toutes les lignes de l'onglet Portefeuille. L'onglet Saisie est restaure a la fin.
Public Sub ScorerPortefeuille()
    Dim ws As Worksheet
    Dim r As Long, dern As Long, nCles As Long, colRes As Long, i As Long, nb As Long
    Dim res As Variant
    Dim calcInitial As XlCalculation
    Set ws = ThisWorkbook.Worksheets("Portefeuille")
    nCles = CompterCles(ws)
    If nCles = 0 Then
        MsgBox "En-tetes de cles introuvables en ligne 4 du Portefeuille.", vbExclamation
        Exit Sub
    End If
    colRes = 6 + nCles
    dern = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If dern < 5 Then
        MsgBox "Aucun dossier a scorer (reference en colonne A a partir de la ligne 5).", vbInformation
        Exit Sub
    End If
    calcInitial = Application.Calculation
    SauvegarderSaisie
    On Error GoTo Fin
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    For r = 5 To dern
        If Len(CStr(ws.Cells(r, 1).Value)) > 0 Then
            ChargerLigne ws, r, nCles
            Application.Calculate
            res = LireResultat()
            For i = 0 To 14
                ws.Cells(r, colRes + i).Value = res(i)
            Next i
            Journaliser CStr(ws.Cells(r, 1).Value), res
            nb = nb + 1
        End If
    Next r
Fin:
    Dim erreur As String
    erreur = Err.Description
    On Error Resume Next
    RestaurerSaisie
    Application.Calculation = calcInitial
    Application.Calculate
    Application.ScreenUpdating = True
    On Error GoTo 0
    If Len(erreur) > 0 Then
        MsgBox "Traitement interrompu : " & erreur, vbCritical
    Else
        MsgBox nb & " dossier(s) score(s). Resultats a droite du tableau.", vbInformation, "Portefeuille"
    End If
End Sub

' Compare le classeur aux cas de reference (issus du moteur de production).
Public Sub ExecuterAutotests()
    Dim ws As Worksheet
    Dim r As Long, dern As Long, nCles As Long, c0 As Long, nOk As Long, nTot As Long
    Dim res As Variant
    Dim ecarts As String
    Dim calcInitial As XlCalculation
    Set ws = ThisWorkbook.Worksheets("Tests")
    nCles = CompterCles(ws)
    If nCles = 0 Then
        MsgBox "En-tetes de cles introuvables en ligne 4 de l'onglet Tests.", vbExclamation
        Exit Sub
    End If
    c0 = 6 + nCles                                   ' 1re colonne "Attendu"
    dern = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    calcInitial = Application.Calculation
    SauvegarderSaisie
    On Error GoTo Fin
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    For r = 5 To dern
        If Len(CStr(ws.Cells(r, 1).Value)) > 0 Then
            nTot = nTot + 1
            ChargerLigne ws, r, nCles
            Application.Calculate
            res = LireResultat()
            ecarts = ComparerCas(ws, r, c0, res)
            ws.Cells(r, c0 + 11).Value = res(0)
            ws.Cells(r, c0 + 12).Value = res(1)
            If Len(ecarts) = 0 Then
                ws.Cells(r, c0 + 13).Value = "OK"
                ws.Cells(r, c0 + 13).Interior.Color = RGB(198, 239, 206)
                nOk = nOk + 1
            Else
                ws.Cells(r, c0 + 13).Value = "ECART : " & ecarts
                ws.Cells(r, c0 + 13).Interior.Color = RGB(255, 199, 206)
            End If
        End If
    Next r
Fin:
    Dim erreur As String
    erreur = Err.Description
    On Error Resume Next
    RestaurerSaisie
    Application.Calculation = calcInitial
    Application.Calculate
    Application.ScreenUpdating = True
    On Error GoTo 0
    If Len(erreur) > 0 Then
        MsgBox "Autotests interrompus : " & erreur, vbCritical
    Else
        MsgBox nOk & " / " & nTot & " cas conformes.", IIf(nOk = nTot, vbInformation, vbExclamation), "Autotests du modele"
    End If
End Sub

' Retourne la liste des ecarts d'un cas de test (chaine vide si conforme).
Private Function ComparerCas(ByVal ws As Worksheet, ByVal r As Long, ByVal c0 As Long, ByVal res As Variant) As String
    Dim s As String
    Dim tol As Double
    Dim k As Long
    tol = 0.02
    If Not Egal(ws.Cells(r, c0).Value, res(0), tol) Then s = s & " score"
    If CStr(ws.Cells(r, c0 + 1).Value) <> CStr(res(1)) Then s = s & " decision"
    If CStr(ws.Cells(r, c0 + 2).Value) <> CStr(res(2)) Then s = s & " classe"
    If Not Egal(ws.Cells(r, c0 + 3).Value, res(3), 0.001) Then s = s & " malus"
    ' "Attendu : incomplet" = Oui  <=>  "Dossier complet" = Non
    If (CStr(ws.Cells(r, c0 + 4).Value) = "Oui") <> (CStr(res(4)) = "Non") Then s = s & " complet"
    If Not Egal(ws.Cells(r, c0 + 5).Value, res(9), tol) Then s = s & " S_eco"
    For k = 0 To 3
        If Not Egal(ws.Cells(r, c0 + 6 + k).Value, res(5 + k), tol) Then s = s & " D" & (k + 1)
    Next k
    If Not Egal(ws.Cells(r, c0 + 10).Value, res(10), tol) Then s = s & " suretes"
    ComparerCas = Trim$(s)
End Function

' Egalite numerique avec tolerance ; egalite de texte si l'une des valeurs n'est pas numerique.
Private Function Egal(ByVal a As Variant, ByVal b As Variant, ByVal tol As Double) As Boolean
    If IsNumeric(a) And IsNumeric(b) And Not IsEmpty(a) And Not IsEmpty(b) Then
        If VarType(a) = vbString Or VarType(b) = vbString Then
            Egal = (CStr(a) = CStr(b))
        Else
            Egal = (Abs(CDbl(a) - CDbl(b)) <= tol)
        End If
    Else
        Egal = (CStr(a) = CStr(b))
    End If
End Function

' Nouveau dossier : vide la saisie et les calculateurs apres confirmation.
' Les parametres de l'etablissement (fonds propres, limites) sont conserves.
Public Sub NouveauDossier()
    If MsgBox("Vider le dossier en cours (saisie et calculateurs) ?" & vbCrLf & _
              "Le journal et les parametres ne sont pas modifies.", vbYesNo + vbQuestion, "Nouveau dossier") <> vbYes Then Exit Sub
    ViderDossier
    ThisWorkbook.Worksheets("Saisie").Activate
    ThisWorkbook.Worksheets("Saisie").Range("C4").Select
End Sub

' Vide la saisie (identite + donnees) et les zones de saisie des calculateurs.
Public Sub ViderDossier()
    Dim noms As Variant
    Dim i As Long
    ThisWorkbook.Worksheets("Saisie").Range("C4:C9").ClearContents
    NomPlage("In_Saisie").ClearContents
    noms = Array("Calc_Auth", "Calc_Valeur", "Calc_Lots", "Calc_Mainlevee", "Calc_Concours", "Calc_Arret")
    For i = LBound(noms) To UBound(noms)
        NomPlage(CStr(noms(i))).ClearContents
    Next i
    ThisWorkbook.Worksheets("Calculateurs").Range("B5").Value = "CONSTRUCTION"
    Application.Calculate
End Sub
