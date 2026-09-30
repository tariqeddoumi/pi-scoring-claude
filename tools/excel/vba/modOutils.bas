Attribute VB_Name = "modOutils"
Option Explicit
'=====================================================================
' modOutils - fonctions utilitaires communes (PI_PROMOTION v4)
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
