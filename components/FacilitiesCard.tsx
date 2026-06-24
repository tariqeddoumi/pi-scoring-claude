import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge, Stat } from "@/components/ui";
import { formatMAD, formatDate } from "@/lib/utils";
import {
  facilityEad,
  projectEad,
  installmentOverdueDays,
  scheduleDpd,
  totalOverdue,
} from "@/lib/domain/facility";

interface InstallmentRow {
  id: string;
  seq: number;
  dueDate: Date;
  amountDue: number;
  amountPaid: number;
}
interface FacilityRow {
  id: string;
  label: string;
  authorizedAmount: number;
  drawnAmount: number;
  ccf: number;
  status: string;
  installments: InstallmentRow[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-800 border-blue-300",
  CLOSED: "bg-slate-100 text-slate-700 border-slate-300",
  DEFAULTED: "bg-red-100 text-red-800 border-red-300",
};

export function FacilitiesCard({
  facilities,
  loanAmount,
}: {
  facilities: FacilityRow[];
  loanAmount: number;
}) {
  if (facilities.length === 0) return null;
  const asOf = new Date();
  const { ead } = projectEad(facilities, loanAmount);
  const allInstallments = facilities.flatMap((f) => f.installments);
  const dpd = scheduleDpd(allInstallments, asOf);
  const overdue = totalOverdue(allInstallments, asOf);

  return (
    <Card>
      <CardHeader><CardTitle>Facilités & EAD réel</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="EAD réel" value={formatMAD(ead)} hint={`vs autorisé ${formatMAD(loanAmount)}`} />
          <Stat label="Tranches" value={facilities.length} />
          <Stat label="Retard max (DPD)" value={`${dpd} j`} />
          <Stat label="Impayé échu" value={formatMAD(overdue)} />
        </div>

        {facilities.map((f) => {
          const fDpd = scheduleDpd(f.installments, asOf);
          return (
            <div key={f.id} className="rounded-md border border-border">
              <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-border bg-muted/40">
                <span className="font-medium">{f.label}</span>
                <Badge className={STATUS_COLORS[f.status] ?? "bg-muted"}>{f.status}</Badge>
                <span className="ml-auto text-sm text-muted-foreground">
                  Tiré {formatMAD(f.drawnAmount)} / autorisé {formatMAD(f.authorizedAmount)} · CCF {Math.round(f.ccf * 100)}%
                  · EAD {formatMAD(facilityEad(f))}
                  {fDpd > 0 && <span className="text-red-600"> · DPD {fDpd}j</span>}
                </span>
              </div>
              {f.installments.length > 0 && (
                <Table>
                  <thead>
                    <tr><Th>#</Th><Th>Échéance</Th><Th>Dû</Th><Th>Payé</Th><Th>Statut</Th></tr>
                  </thead>
                  <tbody>
                    {f.installments.map((i) => {
                      const od = installmentOverdueDays(i, asOf);
                      const paid = i.amountPaid >= i.amountDue;
                      return (
                        <tr key={i.id} className={od > 0 ? "bg-red-50" : ""}>
                          <Td>{i.seq}</Td>
                          <Td className="whitespace-nowrap">{formatDate(i.dueDate)}</Td>
                          <Td className="whitespace-nowrap">{formatMAD(i.amountDue)}</Td>
                          <Td className="whitespace-nowrap">{formatMAD(i.amountPaid)}</Td>
                          <Td>
                            {paid ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Soldée</Badge>
                            ) : od > 0 ? (
                              <Badge className="bg-red-100 text-red-800 border-red-300">Impayé {od}j</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700 border-slate-300">À échoir</Badge>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          EAD réel = encours tiré + CCF × non-tiré. Il sert d'assiette au provisionnement au
          prochain calcul (le montant autorisé n'est utilisé qu'à défaut de facilité).
        </p>
      </CardContent>
    </Card>
  );
}
