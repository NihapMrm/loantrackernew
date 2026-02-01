import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { usePeople, useLoans, calculateTotals, calculateBalance, Person } from '@/hooks/useLoans';
import { AmountDisplay } from '@/components/ui/amount-display';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, ChevronRight, User } from 'lucide-react';

export default function People() {
  const { data: people, isLoading: loadingPeople } = usePeople();
  const { data: loans, isLoading: loadingLoans } = useLoans();
  const [search, setSearch] = useState('');

  const isLoading = loadingPeople || loadingLoans;

  // Calculate balance for each person
  const peopleWithBalances = people?.map((person) => {
    const personLoans = loans?.filter((l) => l.person_id === person.id) || [];
    const openLoans = personLoans.filter((l) => l.status !== 'PAID');
    
    const toReceive = openLoans
      .filter((l) => l.type === 'GIVEN')
      .reduce((sum, l) => sum + calculateBalance(l), 0);
    
    const toPay = openLoans
      .filter((l) => l.type === 'TAKEN')
      .reduce((sum, l) => sum + calculateBalance(l), 0);

    return {
      ...person,
      toReceive,
      toPay,
      netBalance: toReceive - toPay,
      loanCount: personLoans.length,
    };
  }) || [];

  const filteredPeople = peopleWithBalances.filter((person) =>
    person.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">People</h1>
          <Link to="/add-person">
            <Button size="sm" variant="outline" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* People List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : filteredPeople.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center">
              {search ? (
                <p className="text-muted-foreground">No people matching "{search}"</p>
              ) : (
                <>
                  <p className="text-muted-foreground mb-2">No people added yet</p>
                  <Link to="/add-person" className="text-primary font-medium text-sm">
                    Add your first person →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPeople.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        )}
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

  return (
    <Link to={`/person/${person.id}`}>
      <Card className="shadow-card hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{person.name}</p>
              <p className="text-sm text-muted-foreground">
                {person.loanCount} {person.loanCount === 1 ? 'loan' : 'loans'}
              </p>
            </div>

            {/* Balance */}
            <div className="text-right flex-shrink-0">
              {hasBalance ? (
                <>
                  {person.toReceive > 0 && (
                    <AmountDisplay 
                      amount={person.toReceive} 
                      type="GIVEN" 
                      size="sm"
                    />
                  )}
                  {person.toPay > 0 && (
                    <AmountDisplay 
                      amount={person.toPay} 
                      type="TAKEN" 
                      size="sm"
                      className="block"
                    />
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Settled</span>
              )}
            </div>

            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
