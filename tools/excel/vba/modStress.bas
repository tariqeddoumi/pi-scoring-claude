Attribute VB_Name = "modStress"
Option Explicit
'=====================================================================
' modStress - stress test du dossier courant (onglet Saisie)
' Les chocs portent sur les donnees primitives, par IDENTITES COMPTABLES
' (memes regles que l'application) : la marge est recalculee depuis le CA et
' le cout, la LTV depuis la valeur, la LTC en supposant que la banque finance
' le surcout. Les marges negatives sont conservees.
'=====================================================================

' Marge apres choc : m' = 1 - (1 - m) * coutFactor / caFactor
Private Function MargeStressee(ByVal m As Double, ByVal caF As Double, ByVal coutF As Double) As Double
    MargeStressee = Arrondi2((1 - (1 - m / 100) * (coutF / caF)) * 100)
End Function

' Lit une valeur numerique saisie ; False si la donnee est absente ou non numerique.
Private Function LireNum(ByVal cle As String, ByRef v As Double) As Boolean
    Dim cel As Range
    Set cel = CelluleSaisie(cle)
    LireNum = False
    If cel Is Nothing Then Exit Function
    If IsEmpty(cel.Value) Then Exit Function
    If VarType(cel.Value) = vbDouble Or VarType(cel.Value) = vbInteger Or VarType(cel.Value) = vbLong Or VarType(cel.Value) = vbSingle Then
        v = CDbl(cel.Value)
        LireNum = True
    End If
End Function

Private Sub EcrireNum(ByVal cle As String, ByVal v As Double)
    Dim cel As Range
    Set cel = CelluleSaisie(cle)
    If Not (cel Is Nothing) Then cel.Value = v
End Sub

' Diminue une donnee numerique existante (plancher 0 par defaut).
Private Sub Diminuer(ByVal cle As String, ByVal montant As Double)
    Dim v As Double
    If montant > 0 Then
        If LireNum(cle, v) Then
            If v - montant < 0 Then
                EcrireNum cle, 0
            Else
                EcrireNum cle, v - montant
            End If
        End If
    End If
End Sub

' Augmente une donnee numerique existante.
Private Sub Augmenter(ByVal cle As String, ByVal montant As Double)
    Dim v As Double
    If montant > 0 Then
        If LireNum(cle, v) Then EcrireNum cle, v + montant
    End If
End Sub

' Applique un choc combine aux donnees de la Saisie (meme ordre que l'application).
Private Sub AppliquerChoc(ByVal prix As Double, ByVal cout As Double, ByVal retard As Double, _
                          ByVal ventes As Double, ByVal bps As Double, ByVal preventes As Double, ByVal dpdAjout As Double)
    Dim v As Double
    Dim caF As Double, coutF As Double

    ' Leviers de base
    Diminuer "pre_sale_rate", preventes
    If LireNum("dpd_days", v) Then
        If v + dpdAjout < 0 Then
            EcrireNum "dpd_days", 0
        Else
            EcrireNum "dpd_days", v + dpdAjout
        End If
    ElseIf dpdAjout > 0 Then
        EcrireNum "dpd_days", dpdAjout
    End If
    If preventes > 0 Then Diminuer "sales_vs_plan", preventes

    ' Prix -X % : CA x (1-p) ; valeur des surete x (1-p)
    If prix > 0 Then
        caF = 1 - prix / 100
        If LireNum("gross_margin_pct", v) Then EcrireNum "gross_margin_pct", MargeStressee(v, caF, 1)
        If LireNum("stressed_margin_pct", v) Then EcrireNum "stressed_margin_pct", MargeStressee(v, caF, 1)
        If caF > 0 Then
            If LireNum("ltv_stressed", v) Then EcrireNum "ltv_stressed", Arrondi2(v / caF)
        End If
        Diminuer "pre_sale_rate", prix * 0.5
    End If

    ' Cout +X % : la banque finance le surcout => LTC' = (LTC + c) / (1 + c)
    If cout > 0 Then
        coutF = 1 + cout / 100
        If LireNum("gross_margin_pct", v) Then EcrireNum "gross_margin_pct", MargeStressee(v, 1, coutF)
        If LireNum("stressed_margin_pct", v) Then EcrireNum "stressed_margin_pct", MargeStressee(v, 1, coutF)
        If LireNum("ltc", v) Then EcrireNum "ltc", Arrondi2((v + cout) / coutF)
        Augmenter "funding_gap_pct", cout
    End If

    ' Retard +N mois
    If retard > 0 Then
        Augmenter "construction_delay_months", retard
        Diminuer "progress_vs_plan", retard * 3
        Diminuer "sales_vs_plan", retard * 2
    End If

    ' Ventes -X %
    Diminuer "sales_vs_plan", ventes
    Diminuer "pre_sale_rate", ventes * 0.6
    Augmenter "stock_rotation_months", ventes * 0.3

    ' Taux +N bps
    If bps > 0 Then
        Diminuer "interest_coverage", (bps / 100) * 0.3
        Diminuer "cash_coverage", (bps / 100) * 0.05
    End If
End Sub

' Lance tous les scenarios de l'onglet Stress sur le dossier courant.
Public Sub LancerStress()
    Dim ws As Worksheet
    Dim r As Long
    Dim res As Variant
    Dim scoreBase As Double
    Dim calcInitial As XlCalculation
    Dim erreur As String
    Set ws = ThisWorkbook.Worksheets("Stress")
    calcInitial = Application.Calculation
    SauvegarderSaisie
    On Error GoTo Fin
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    Application.Calculate
    res = LireResultat()
    scoreBase = CDbl(res(0))
    ws.Range("C3").Value = res(0)
    ws.Range("E3").Value = LibelleDecision(res(1))
    For r = 5 To 14
        If Len(CStr(ws.Cells(r, 1).Value)) > 0 Then
            RemettreEtatSauvegarde
            AppliquerChoc Nz0(ws.Cells(r, 3).Value), Nz0(ws.Cells(r, 4).Value), Nz0(ws.Cells(r, 5).Value), _
                          Nz0(ws.Cells(r, 6).Value), Nz0(ws.Cells(r, 7).Value), Nz0(ws.Cells(r, 8).Value), Nz0(ws.Cells(r, 9).Value)
            Application.Calculate
            res = LireResultat()
            ws.Cells(r, 10).Value = res(0)
            ws.Cells(r, 11).Value = LibelleDecision(res(1))
            ws.Cells(r, 12).Value = Arrondi2(CDbl(res(0)) - scoreBase)
        End If
    Next r
Fin:
    erreur = Err.Description
    On Error Resume Next
    RestaurerSaisie
    Application.Calculation = calcInitial
    Application.Calculate
    Application.ScreenUpdating = True
    On Error GoTo 0
    If Len(erreur) > 0 Then
        MsgBox "Stress interrompu : " & erreur, vbCritical
    Else
        ws.Activate
        MsgBox FR("Stress termin~e : 7 sc~enarios. Le dossier courant a ~et~e restaur~e."), vbInformation, "Stress test"
    End If
End Sub

Private Function Nz0(ByVal v As Variant) As Double
    If IsError(v) Then
        Nz0 = 0
    ElseIf IsNumeric(v) And Not IsEmpty(v) Then
        Nz0 = CDbl(v)
    Else
        Nz0 = 0
    End If
End Function
