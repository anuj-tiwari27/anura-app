import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { Labels, type CaseSummaryView } from '@anura/shared';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { formatDate } from '@/lib/format';

export function RecentCases({ cases }: { cases: CaseSummaryView[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Recent cases
        </CardTitle>
        <Link href="/cases" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {cases.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No cases yet"
            description="Create your first case to start tracking hearings, parties, and documents."
            className="border-0 bg-transparent py-10"
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Case</TH>
                <TH className="hidden sm:table-cell">Client</TH>
                <TH>Status</TH>
                <TH className="hidden md:table-cell">Next hearing</TH>
              </TR>
            </THead>
            <TBody>
              {cases.map((c) => (
                <TR key={c.id} className="cursor-pointer">
                  <TD>
                    <Link href={`/cases/${c.id}`} className="block">
                      <span className="font-medium text-foreground hover:text-primary">{c.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {c.caseNumber ?? c.cnr ?? (c.practiceArea ? Labels.PracticeArea[c.practiceArea] : 'No number')}
                      </span>
                    </Link>
                  </TD>
                  <TD className="hidden text-sm text-muted-foreground sm:table-cell">
                    {c.clientName ?? '—'}
                  </TD>
                  <TD>
                    <StatusBadge kind="case" value={c.status} />
                  </TD>
                  <TD className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(c.nextHearingDate)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
