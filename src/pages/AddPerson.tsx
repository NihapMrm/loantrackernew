import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useCreatePerson, useUpdatePerson, usePerson } from '@/hooks/useLoans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const personSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  phone: z.string().trim().max(20, 'Phone number is too long').optional(),
  notes: z.string().trim().max(500, 'Notes are too long').optional(),
});

export default function AddPerson() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  
  const { data: existingPerson, isLoading } = usePerson(id);
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; notes?: string }>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  if (isEdit && existingPerson && !initialized) {
    setName(existingPerson.name);
    setPhone(existingPerson.phone || '');
    setNotes(existingPerson.notes || '');
    setInitialized(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = personSchema.parse({ name, phone, notes });
      setErrors({});

      if (isEdit && id) {
        await updatePerson.mutateAsync({ 
          id, 
          name: validated.name, 
          phone: validated.phone, 
          notes: validated.notes 
        });
      } else {
        await createPerson.mutateAsync({ 
          name: validated.name, 
          phone: validated.phone, 
          notes: validated.notes 
        });
      }
      
      navigate(-1);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: typeof errors = {};
        err.errors.forEach((e) => {
          const field = e.path[0] as keyof typeof errors;
          fieldErrors[field] = e.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const isPending = createPerson.isPending || updatePerson.isPending;

  if (isEdit && isLoading) {
    return (
      <MobileLayout showNav={false}>
        <div className="px-4 pt-6 text-center text-muted-foreground">Loading...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto lg:px-8 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-primary" />
            <span className="text-sm font-black tracking-tight text-foreground uppercase">
              {isEdit ? 'Edit Person' : 'Add Person'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="shadow-card">
            <CardContent className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="lg:text-base"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="lg:text-base"
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="lg:text-base"
                />
                {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex gap-3 lg:gap-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 lg:text-base"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 lg:text-base" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Update' : 'Add Person'}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
