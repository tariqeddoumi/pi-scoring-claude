Attribute VB_Name = "modModele"
Option Explicit
'=====================================================================
' modModele - gouvernance du modele : validation, listes, instantane
'=====================================================================

' Format "Classeur Excel (.xlsx)" (= xlOpenXMLWorkbook), en valeur pour rester portable.
Private Const FORMAT_XLSX As Long = 51

Private mLigne As Long
Private mNbErr As Long
Private mNbAvert As Long

Private Sub Ecrire(ByVal wsV As Worksheet, ByVal statut As String, ByVal controle As String, ByVal detail As String)
    wsV.Cells(mLigne, 1).Value = statut
    wsV.Cells(mLigne, 2).Value = controle
    wsV.Cells(mLigne, 3).Value = detail
    Select Case statut
        Case "ERREUR"
            wsV.Cells(mLigne, 1).Interior.Color = RGB(255, 199, 206)
            mNbErr = mNbErr + 1
        Case "AVERT."
            wsV.Cells(mLigne, 1).Interior.Color = RGB(255, 235, 156)
            mNbAvert = mNbAvert + 1
        Case Else
            wsV.Cells(mLigne, 1).Interior.Color = RGB(198, 239, 206)
    End Select
    mLigne = mLigne + 1
End Sub

' Controles semantiques du modele (equivalents des controles de publication de l'application).
Public Sub ValiderModele()
    Dim wsV As Worksheet
    Dim wsK As Worksheet, wsB As Worksheet, wsA As Worksheet, wsG As Worksheet
    Dim r As Long, i As Long, n As Long
    Dim code As String, dom As String, typ As String
    Dim somme As Double
    Dim wf As WorksheetFunction
    Set wf = Application.WorksheetFunction
    Set wsK = ThisWorkbook.Worksheets("P_Criteres")
    Set wsB = ThisWorkbook.Worksheets("P_Baremes")
    Set wsA = ThisWorkbook.Worksheets("P_Alertes")
    Set wsG = ThisWorkbook.Worksheets("P_General")
    If FeuilleExiste("Validation") Then
        Set wsV = ThisWorkbook.Worksheets("Validation")
        wsV.Cells.Clear
    Else
        Set wsV = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        wsV.Name = "Validation"
    End If
    wsV.Range("A1").Value = "Validation du modele " & CStr(NomPlage("P_Version").Value) & " - " & Format(Now, "dd/mm/yyyy hh:mm")
    wsV.Range("A1").Font.Bold = True
    wsV.Range("A3:C3").Value = Array("Statut", "Controle", "Detail")
    wsV.Range("A3:C3").Font.Bold = True
    wsV.Columns("A").ColumnWidth = 10
    wsV.Columns("B").ColumnWidth = 55
    wsV.Columns("C").ColumnWidth = 90
    mLigne = 4: mNbErr = 0: mNbAvert = 0

    ' 1. Poids des domaines
    somme = wf.Sum(NomPlage("P_DomPoids"))
    If Abs(somme - 1) < 0.000001 Then
        Ecrire wsV, "OK", "Somme des poids de domaines = 100 %", Format(somme, "0.0000")
    Else
        Ecrire wsV, "ERREUR", "Somme des poids de domaines <> 100 %", "Somme = " & Format(somme, "0.0000")
    End If

    ' 2. Poids des criteres par domaine
    For r = 16 To 23
        dom = CStr(wsG.Cells(r, 1).Value)
        If Len(dom) > 0 Then
            somme = wf.SumIf(wsK.Range("B5:B64"), dom, wsK.Range("E5:E64"))
            If Abs(somme - 1) < 0.000001 Then
                Ecrire wsV, "OK", "Poids des criteres du domaine " & dom & " = 100 %", Format(somme, "0.0000")
            Else
                Ecrire wsV, "ERREUR", "Poids des criteres du domaine " & dom & " <> 100 %", "Somme = " & Format(somme, "0.0000")
            End If
        End If
    Next r

    ' 3. Unicite des codes, existence du bareme, cle de saisie
    For r = 5 To 64
        code = CStr(wsK.Cells(r, 1).Value)
        If Len(code) > 0 Then
            typ = CStr(wsK.Cells(r, 4).Value)
            If wf.CountIf(wsK.Range("A5:A64"), code) > 1 Then Ecrire wsV, "ERREUR", "Code de critere en double : " & code, ""
            If PosCle(CStr(wsK.Cells(r, 6).Value)) = 0 Then Ecrire wsV, "ERREUR", "Cle absente de l'onglet Saisie : " & CStr(wsK.Cells(r, 6).Value), "Critere " & code
            If wf.CountIf(wsB.Range("A5:A400"), code) = 0 Then
                Ecrire wsV, "ERREUR", "Critere sans bareme : " & code, ""
            ElseIf typ = "NUM" Then
                ControlerPlages wsV, wsB, code
            ElseIf typ = "QUAL" Then
                If wf.CountIfs(wsB.Range("A5:A400"), code, wsB.Range("B5:B400"), "MODALITE") = 0 Then Ecrire wsV, "ERREUR", "Critere qualitatif sans modalite : " & code, ""
            End If
            If CStr(wsK.Cells(r, 7).Value) = "Oui" And Not IsNumeric(wsK.Cells(r, 8).Value) Then Ecrire wsV, "ERREUR", "Gate sans seuil : " & code, ""
            If Len(CStr(wsK.Cells(r, 7).Value)) > 0 And IsEmpty(wsK.Cells(r, 8).Value) And CStr(wsK.Cells(r, 7).Value) = "Oui" Then Ecrire wsV, "ERREUR", "Seuil de gate vide : " & code, ""
            n = n + 1
        End If
    Next r
    Ecrire wsV, "OK", "Criteres controles", n & " critere(s)"

    ' 4. Alertes
    For r = 5 To 34
        code = CStr(wsA.Cells(r, 1).Value)
        If Len(code) > 0 Then
            If InStr("|LOW|MEDIUM|HIGH|BLOCKING|", "|" & CStr(wsA.Cells(r, 3).Value) & "|") = 0 Then Ecrire wsV, "ERREUR", "Severite invalide : " & code, CStr(wsA.Cells(r, 3).Value)
            If InStr("|isTrue|isFalse|eq|neq|gt|gte|lt|lte|", "|" & CStr(wsA.Cells(r, 7).Value) & "|") = 0 Then Ecrire wsV, "ERREUR", "Operateur invalide : " & code, CStr(wsA.Cells(r, 7).Value)
            If PosCle(CStr(wsA.Cells(r, 6).Value)) = 0 Then Ecrire wsV, "ERREUR", "Cle d'alerte absente de la Saisie : " & CStr(wsA.Cells(r, 6).Value), code
            If Not IsNumeric(wsA.Cells(r, 4).Value) Or IsEmpty(wsA.Cells(r, 4).Value) Then
                Ecrire wsV, "ERREUR", "Malus non numerique : " & code, ""
            ElseIf CStr(wsA.Cells(r, 3).Value) = "BLOCKING" And CDbl(wsA.Cells(r, 4).Value) <> 0 Then
                Ecrire wsV, "AVERT.", "Alerte bloquante avec malus <> 0 : " & code, "La souffrance automatique ne devrait pas porter de malus"
            End If
            If InStr("|gt|gte|lt|lte|eq|neq|", "|" & CStr(wsA.Cells(r, 7).Value) & "|") > 0 And IsEmpty(wsA.Cells(r, 8).Value) Then Ecrire wsV, "ERREUR", "Valeur de reference manquante : " & code, ""
        End If
    Next r
    Ecrire wsV, "OK", "Alertes controlees", ""

    ' 5. Seuils de decision
    If NomPlage("P_GO").Value > NomPlage("P_GWC").Value And NomPlage("P_GWC").Value > NomPlage("P_WATCH").Value Then
        Ecrire wsV, "OK", "Seuils de decision ordonnes (GO > GO sous conditions > Watch list)", ""
    Else
        Ecrire wsV, "ERREUR", "Seuils de decision non ordonnes", "GO " & NomPlage("P_GO").Value & " / GWC " & NomPlage("P_GWC").Value & " / Watch " & NomPlage("P_WATCH").Value
    End If

    ' 6. Coefficients BAM
    For r = 27 To 36
        If Len(CStr(wsG.Cells(r, 1).Value)) > 0 Then
            If Not IsNumeric(wsG.Cells(r, 5).Value) Or IsEmpty(wsG.Cells(r, 5).Value) Then
                Ecrire wsV, "ERREUR", "Coefficient BAM manquant : " & CStr(wsG.Cells(r, 1).Value), ""
            End If
        End If
    Next r

    wsV.Visible = xlSheetVisible
    wsV.Activate
    MsgBox mNbErr & " erreur(s), " & mNbAvert & FR(" avertissement(s). D~etail dans l'onglet Validation."), _
           IIf(mNbErr = 0, vbInformation, vbExclamation), FR("Validation du mod~ele")
End Sub

' Verifie la continuite des plages d'un critere numerique : un seul debut, une seule fin,
' chaque borne haute est la borne basse d'une autre plage (pas de trou, pas de chevauchement).
Private Sub ControlerPlages(ByVal wsV As Worksheet, ByVal wsB As Worksheet, ByVal code As String)
    Dim lignes() As Long
    Dim nb As Long, r As Long, i As Long, j As Long
    Dim debuts As Long, fins As Long, corr As Long
    Dim ok As Boolean
    ok = True
    For r = 5 To 400
        If CStr(wsB.Cells(r, 1).Value) = code And CStr(wsB.Cells(r, 2).Value) = "PLAGE" Then
            nb = nb + 1
            ReDim Preserve lignes(1 To nb)
            lignes(nb) = r
        End If
    Next r
    If nb = 0 Then
        Ecrire wsV, "ERREUR", "Critere numerique sans plage : " & code, ""
        Exit Sub
    End If
    For i = 1 To nb
        r = lignes(i)
        If IsEmpty(wsB.Cells(r, 4).Value) Then debuts = debuts + 1
        If IsEmpty(wsB.Cells(r, 5).Value) Then fins = fins + 1
        If Not IsEmpty(wsB.Cells(r, 4).Value) And Not IsEmpty(wsB.Cells(r, 5).Value) Then
            If CDbl(wsB.Cells(r, 4).Value) >= CDbl(wsB.Cells(r, 5).Value) Then
                Ecrire wsV, "ERREUR", "Plage vide ou inversee : " & code, "Ligne " & r
                ok = False
            End If
        End If
        If Not IsEmpty(wsB.Cells(r, 5).Value) Then
            corr = 0
            For j = 1 To nb
                If Not IsEmpty(wsB.Cells(lignes(j), 4).Value) Then
                    If CDbl(wsB.Cells(lignes(j), 4).Value) = CDbl(wsB.Cells(r, 5).Value) Then corr = corr + 1
                End If
            Next j
            If corr <> 1 Then
                Ecrire wsV, "ERREUR", "Trou ou chevauchement de plages : " & code, "Borne haute " & wsB.Cells(r, 5).Value & " (ligne " & r & ")"
                ok = False
            End If
        End If
    Next i
    If debuts <> 1 Then
        Ecrire wsV, "ERREUR", "Plages non couvertes a gauche (ou plusieurs debuts) : " & code, ""
        ok = False
    End If
    If fins <> 1 Then
        Ecrire wsV, "ERREUR", "Plages non couvertes a droite (ou plusieurs fins) : " & code, ""
        ok = False
    End If
    If ok Then Ecrire wsV, "OK", "Plages continues : " & code, nb & " plage(s)"
End Sub

' Reconstruit les listes deroulantes des criteres qualitatifs depuis P_Baremes : libelles en clair
' (plage des modalites du critere). La saisie d'un code reste acceptee (simple avertissement).
Public Sub RafraichirListes()
    Dim wsS As Worksheet, wsK As Worksheet, wsB As Worksheet
    Dim r As Long, k As Long, b As Long, nb As Long, premier As Long, dernier As Long, compte As Long
    Dim cle As String, crit As String
    Set wsS = ThisWorkbook.Worksheets("Saisie")
    Set wsK = ThisWorkbook.Worksheets("P_Criteres")
    Set wsB = ThisWorkbook.Worksheets("P_Baremes")
    Deproteger wsS
    For r = 13 To 92
        If CStr(wsS.Cells(r, 4).Value) = "QUAL" Then
            cle = CStr(wsS.Cells(r, 2).Value)
            crit = ""
            For k = 5 To 64
                If CStr(wsK.Cells(k, 6).Value) = cle Then crit = CStr(wsK.Cells(k, 1).Value)
            Next k
            If Len(crit) > 0 Then
                premier = 0: dernier = 0: compte = 0
                For b = 5 To 400
                    If CStr(wsB.Cells(b, 1).Value) = crit And CStr(wsB.Cells(b, 2).Value) = "MODALITE" Then
                        If premier = 0 Then premier = b
                        dernier = b
                        compte = compte + 1
                    End If
                Next b
                If compte > 0 And compte = dernier - premier + 1 Then
                    With wsS.Cells(r, 5).Validation
                        .Delete
                        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertWarning, _
                             Formula1:="=P_Baremes!$F$" & premier & ":$F$" & dernier
                    End With
                    nb = nb + 1
                End If
            End If
        End If
    Next r
    Proteger wsS
    MsgBox nb & FR(" liste(s) d~eroulante(s) mise(s) ~a jour. Les modalit~es d'un crit~ere doivent se suivre dans P_Baremes."), vbInformation, "Listes"
End Sub

' Exporte les parametres du modele (valeurs) dans un classeur date, pour archivage / versionnement.
Public Sub SnapshotModele()
    Dim noms As Variant
    Dim wbN As Workbook
    Dim src As Worksheet, dst As Worksheet
    Dim i As Long, nr As Long, nc As Long
    Dim chemin As String, fichier As String
    noms = Array("P_General", "P_Criteres", "P_Baremes", "P_Alertes", "P_Ajustements", "P_Referentiels")
    Set wbN = Workbooks.Add
    Application.DisplayAlerts = False
    Do While wbN.Worksheets.Count > 1
        wbN.Worksheets(wbN.Worksheets.Count).Delete
    Loop
    Application.DisplayAlerts = True
    For i = 0 To UBound(noms)
        Set src = ThisWorkbook.Worksheets(CStr(noms(i)))
        If i = 0 Then
            Set dst = wbN.Worksheets(1)
        Else
            Set dst = wbN.Worksheets.Add(After:=wbN.Worksheets(wbN.Worksheets.Count))
        End If
        dst.Name = CStr(noms(i))
        nr = src.UsedRange.Rows.Count
        nc = src.UsedRange.Columns.Count
        dst.Cells(1, 1).Resize(nr, nc).Value2 = src.UsedRange.Value2
    Next i
    chemin = ThisWorkbook.Path
    If Len(chemin) = 0 Then chemin = Environ("TEMP")
    If Len(chemin) = 0 Then chemin = Application.DefaultFilePath
    fichier = chemin & SepChemin() & "PI_Promotion_parametres_" & CStr(NomPlage("P_Version").Value) & "_" & Format(Now, "yyyymmdd_hhmm") & ".xlsx"
    wbN.SaveAs Filename:=fichier, FileFormat:=FORMAT_XLSX
    MsgBox "Instantane enregistre :" & vbCrLf & fichier, vbInformation, "Instantane du modele"
End Sub
