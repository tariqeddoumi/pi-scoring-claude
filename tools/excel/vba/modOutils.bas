Attribute VB_Name = "modOutils"
Option Explicit
'=====================================================================
' modOutils - fonctions utilitaires communes (PI_PROMOTION v5, outil 5.1)
' Le moteur de calcul est dans les FORMULES du classeur (onglet Resultat).
' Les macros ne font que charger des donnees, recalculer et lire le resultat.
'=====================================================================

Private mSaisieE As Variant      ' sauvegarde des valeurs saisies (Saisie!E)
Private mSaisieC As Variant      ' sauvegarde de l'identite du dossier (Saisie!C4:C9)
Private mSauvegarde As Boolean

' Renvoie la plage portant le nom donne (noms definis au niveau du classeur).
Public Function NomPlage(ByVal nom As String) As Range
    Set NomPlage = ThisWorkbook.Names(nom).RefersToRange
End Function

' Derniere ligne non vide d'une colonne (1 si vide). Parcours de la zone utilisee plutot que
' End(xlUp) : meme resultat sous Excel et sous LibreOffice, sans dependre de l'affichage.
Public Function DerniereLigne(ByVal ws As Worksheet, ByVal col As Long) As Long
    Dim r As Long
    r = ws.UsedRange.Row + ws.UsedRange.Rows.Count - 1
    Do While r > 1
        If Len(CStr(ws.Cells(r, col).Value)) > 0 Then Exit Do
        r = r - 1
    Loop
    DerniereLigne = r
End Function

Public Function FeuilleExiste(ByVal nom As String) As Boolean
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(nom)
    On Error GoTo 0
    FeuilleExiste = Not (ws Is Nothing)
End Function

' Position (1..n) d'une cle technique dans la liste des donnees de la Saisie ; 0 si absente.
' Recherche explicite (et non Application.Match) : meme comportement quel que soit le tableur.
Public Function PosCle(ByVal cle As String) As Long
    Dim t As Variant
    Dim i As Long
    PosCle = 0
    If Len(cle) = 0 Then Exit Function
    t = NomPlage("In_Cles").Value2
    For i = LBound(t, 1) To UBound(t, 1)
        If StrComp(CStr(t(i, 1)), cle, vbTextCompare) = 0 Then
            PosCle = i - LBound(t, 1) + 1
            Exit Function
        End If
    Next i
End Function

' Cellule de saisie (colonne E) d'une cle technique ; Nothing si la cle est inconnue.
Public Function CelluleSaisie(ByVal cle As String) As Range
    Dim p As Long
    p = PosCle(cle)
    If p = 0 Then
        Set CelluleSaisie = Nothing
    Else
        Set CelluleSaisie = NomPlage("In_Saisie").Cells(p, 1)
    End If
End Function

' Ecrit une valeur dans une cellule ; une valeur vide efface la cellule.
Public Sub PoserValeur(ByVal cellule As Range, ByVal v As Variant)
    If IsError(v) Then
        cellule.ClearContents
    ElseIf IsEmpty(v) Then
        cellule.ClearContents
    ElseIf VarType(v) = vbString And Len(v) = 0 Then
        cellule.ClearContents
    Else
        cellule.Value = v
    End If
End Sub

' Nombre de colonnes "cle" d'une feuille de type Portefeuille / Tests (ligne 4, a partir de la colonne F).
Public Function CompterCles(ByVal ws As Worksheet) As Long
    Dim c As Long
    c = 6
    Do While Len(CStr(ws.Cells(4, c).Value)) > 0
        If PosCle(CStr(ws.Cells(4, c).Value)) = 0 Then Exit Do
        c = c + 1
    Loop
    CompterCles = c - 6
End Function

' Sauvegarde l'etat courant de la feuille Saisie pour le restaurer apres un traitement de masse.
Public Sub SauvegarderSaisie()
    mSaisieE = NomPlage("In_Saisie").Value2
    mSaisieC = ThisWorkbook.Worksheets("Saisie").Range("C4:C9").Value2
    mSauvegarde = True
End Sub

Public Sub RestaurerSaisie()
    If Not mSauvegarde Then Exit Sub
    NomPlage("In_Saisie").Value2 = mSaisieE
    ThisWorkbook.Worksheets("Saisie").Range("C4:C9").Value2 = mSaisieC
End Sub

' Remet les donnees saisies dans l'etat sauvegarde (utilise entre deux scenarios de stress).
Public Sub RemettreEtatSauvegarde()
    If Not mSauvegarde Then Exit Sub
    NomPlage("In_Saisie").Value2 = mSaisieE
End Sub

Public Function NomUtilisateur() As String
    Dim u As String
    u = Environ("USERNAME")
    If Len(u) = 0 Then u = Environ("USER")
    If Len(u) = 0 Then
        On Error Resume Next
        u = Application.UserName
        On Error GoTo 0
    End If
    If Len(u) = 0 Then u = "inconnu"
    NomUtilisateur = u
End Function

' Valeur logique d'une cellule, quel que soit son codage (VRAI/FAUX, 1/0, "Oui"/"Non").
Public Function EstVrai(ByVal v As Variant) As Boolean
    EstVrai = False
    If IsError(v) Or IsEmpty(v) Then Exit Function
    Select Case VarType(v)
        Case vbBoolean
            EstVrai = v
        Case vbString
            Select Case UCase$(Trim$(v))
                Case "VRAI", "TRUE", "OUI", "1"
                    EstVrai = True
            End Select
        Case Else
            If IsNumeric(v) Then EstVrai = (CDbl(v) <> 0)
    End Select
End Function

Public Function Arrondi2(ByVal x As Double) As Double
    Arrondi2 = Application.WorksheetFunction.Round(x, 2)
End Function

Public Function SepChemin() As String
    SepChemin = Application.PathSeparator
End Function

' Texte francais avec accents, a partir d'un code source ASCII (fichiers .bas portables) :
' ~e e aigu, ~E E aigu, ~g e grave, ~a a grave, ~h e circonflexe, ~c c cedille, ~o o circonflexe, ~i i circonflexe, ~u u grave,
' ~< et ~> guillemets francais.
Public Function FR(ByVal s As String) As String
    s = Replace(s, "~<", ChrW(171) & ChrW(160))
    s = Replace(s, "~>", ChrW(160) & ChrW(187))
    s = Replace(s, "~e", ChrW(233))
    s = Replace(s, "~E", ChrW(201))
    s = Replace(s, "~g", ChrW(232))
    s = Replace(s, "~a", ChrW(224))
    s = Replace(s, "~h", ChrW(234))
    s = Replace(s, "~c", ChrW(231))
    s = Replace(s, "~o", ChrW(244))
    s = Replace(s, "~i", ChrW(238))
    s = Replace(s, "~u", ChrW(249))
    FR = s
End Function

' Libelle en clair d'une decision (table P_DecTbl) ; le code si inconnu.
Public Function LibelleDecision(ByVal code As Variant) As String
    Dim t As Variant
    Dim i As Long
    LibelleDecision = CStr(code)
    On Error GoTo Fin
    t = NomPlage("P_DecTbl").Value2
    For i = LBound(t, 1) To UBound(t, 1)
        If CStr(t(i, 1)) = CStr(code) Then
            LibelleDecision = CStr(t(i, 2))
            Exit Function
        End If
    Next i
Fin:
End Function

' Active / neutralise les calculateurs (nom Calc_Actif). Neutralises pendant les traitements
' de masse : aucune valeur des calculateurs du dossier courant ne doit se meler aux lignes scorees.
Public Sub CalculateursActifs(ByVal actif As Boolean)
    NomPlage("Calc_Actif").Value = actif
End Sub

' Protection des feuilles (sans mot de passe) : seules les cellules jaunes sont modifiables.
Public Sub Deproteger(ByVal ws As Worksheet)
    On Error Resume Next
    ws.Unprotect ""
    On Error GoTo 0
End Sub

Public Sub Proteger(ByVal ws As Worksheet)
    On Error Resume Next
    ws.Protect Password:="", DrawingObjects:=True, Contents:=True, Scenarios:=True, _
               AllowFormattingColumns:=True, AllowFormattingRows:=True
    If Err.Number <> 0 Then
        Err.Clear
        ws.Protect ""
    End If
    On Error GoTo 0
End Sub
