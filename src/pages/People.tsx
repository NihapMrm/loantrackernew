import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { usePeople, useLoans, calculateBalance, Person } from '@/hooks/useLoans';
import { AmountDisplay, MarqueeAmount } from '@/components/ui/amount-display';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, Users, ArrowUpRight, ArrowDownLeft, User } from 'lucide-react';

export default function People() {
  const { data: people, isLoading: loadingPeople } = usePeople();
  const { data: loans, isLoading: loadingLoans } = useLoans();
  const [search, setSearch] = useState('');

  const isLoading = loadingPeople || loadingLoans;

  const peopleWithBalances = people?.map((person) => {
    const personLoans = loans?.filter((l) => l.person_id === person.id) || [];
    const openLoans = personLoans.filter((l) => l.status !== 'PAID');
    const toReceive = openLoans.filter((l) => l.type === 'GIVEN').reduce((sum, l) => sum + calculateBalance(l), 0);
    const toPay = openLoans.filter((l) => l.type === 'TAKEN').reduce((sum, l) => sum + calculateBalance(l), 0);
    return { ...person, toReceive, toPay, netBalance: toReceive - toPay, loanCount: personLoans.length };
  }) || [];

  const filteredPeople = peopleWithBalances.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalReceive = peopleWithBalances.reduce((s, p) => s + p.toReceive, 0);
  const totalPay    = peopleWithBalances.reduce((s, p) => s + p.toPay, 0);

  return (
    <MobileLayout>
      <div className="pb-4 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="px-4 pt-6 pb-2 lg:px-10 lg:pt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-primary" />
              <span className="text-sm font-black tracking-tight text-foreground">People</span>
            </div>
            <Link to="/add-person">
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl h-8 text-xs">
                <UserPlus className="w-3.5 h-3.5" />
                Add
              </Button>
            </Link>
          </div>

          {/* Summary bento */}
          <div className="grid grid-cols-5 grid-rows-2 gap-2.5 h-[120px]">

            {/* People count — tall left */}
            <div className="col-span-5 row-span-2 rounded-2xl bg-foreground p-4 flex flex-row justify-between items-center relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex gap-2 flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 z-10">People</p>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-white/50" />
                <span className="text-[11px] text-white/50 font-medium">Manage all your peoples here</span>
              </div>

              </div>
              <div className="z-10">
                {isLoading
                  ? <Skeleton className="h-10 w-16 bg-white/20 rounded-lg mb-1" />
                  : <p className="text-4xl font-black text-white leading-none mb-1">{people?.length ?? 0}</p>
                }
              </div>
            </div>

        

       

          </div>
        </div>

        {/* ── Search ── */}
        <div className="px-4 pt-3 pb-1 lg:px-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-10"
            />
          </div>
        </div>

        {/* ── List ── */}
        <div className="px-4 pt-2 lg:px-10">
          {isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
            </div>
          ) : filteredPeople.length === 0 ? (
            <Card className="shadow-card rounded-2xl">
              <CardContent className="p-6 text-center">
                {search ? (
                  <p className="text-muted-foreground">No people matching "{search}"</p>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-2">No people added yet</p>
                    <Link to="/add-person" className="text-primary font-medium text-sm">Add your first person →</Link>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {filteredPeople.map(person => <PersonCard key={person.id} person={person} />)}
            </div>
          )}
        </div>

      </div>
    </MobileLayout>
  );
}

interface PersonWithBalance extends Person {
  toReceive: number;
  toPay: number;
  netBalance: number;
  loanCount: number;
}

function PersonCard({ person }: { person: PersonWithBalance }) {
  const hasBalance = person.toReceive > 0 || person.toPay > 0;
  const initials = person.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Link to={`/person/${person.id}`}>
      <Card className="shadow-card hover:shadow-md transition-all cursor-pointer rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">

            {/* Avatar */}
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              {initials
                ? <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{initials}</span>
                : <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate">{person.name}</p>
              <p className="text-xs text-muted-foreground">
                {person.loanCount} {person.loanCount === 1 ? 'loan' : 'loans'}
              </p>
            </div>

            {/* Balance */}
            <div className="text-right shrink-0">
              {hasBalance ? (
                <div className="space-y-0.5">
                  {person.toReceive > 0 && (
                    <MarqueeAmount className="max-w-[100px]">
                      <AmountDisplay amount={person.toReceive} type="GIVEN" size="sm" />
                    </MarqueeAmount>
                  )}
                  {person.toPay > 0 && (
                    <MarqueeAmount className="max-w-[100px]">
                      <AmountDisplay amount={person.toPay} type="TAKEN" size="sm" className="block" />
                    </MarqueeAmount>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Settled</span>
              )}
            </div>

          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
