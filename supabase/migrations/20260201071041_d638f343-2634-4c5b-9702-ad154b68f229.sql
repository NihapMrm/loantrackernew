-- Create enum types for loan type and status
CREATE TYPE public.loan_type AS ENUM ('GIVEN', 'TAKEN');
CREATE TYPE public.loan_status AS ENUM ('OPEN', 'PARTIAL', 'PAID');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create people table (contacts that users lend to/borrow from)
CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create loans table
CREATE TABLE public.loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  type loan_type NOT NULL,
  status loan_status NOT NULL DEFAULT 'OPEN',
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- People RLS policies
CREATE POLICY "Users can view own people" ON public.people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own people" ON public.people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own people" ON public.people FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own people" ON public.people FOR DELETE USING (auth.uid() = user_id);

-- Loans RLS policies
CREATE POLICY "Users can view own loans" ON public.loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loans" ON public.loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loans" ON public.loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loans" ON public.loans FOR DELETE USING (auth.uid() = user_id);

-- Payments RLS policies (through loan ownership)
CREATE POLICY "Users can view payments on own loans" ON public.payments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.loans WHERE loans.id = payments.loan_id AND loans.user_id = auth.uid()));
CREATE POLICY "Users can insert payments on own loans" ON public.payments FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.loans WHERE loans.id = payments.loan_id AND loans.user_id = auth.uid()));
CREATE POLICY "Users can update payments on own loans" ON public.payments FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.loans WHERE loans.id = payments.loan_id AND loans.user_id = auth.uid()));
CREATE POLICY "Users can delete payments on own loans" ON public.payments FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.loans WHERE loans.id = payments.loan_id AND loans.user_id = auth.uid()));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-update loan status based on payments
CREATE OR REPLACE FUNCTION public.update_loan_status()
RETURNS TRIGGER AS $$
DECLARE
  loan_amount DECIMAL(12, 2);
  total_paid DECIMAL(12, 2);
BEGIN
  -- Get the loan amount
  SELECT amount INTO loan_amount FROM public.loans WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- Get total payments
  SELECT COALESCE(SUM(amount), 0) INTO total_paid 
  FROM public.payments 
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  -- Update loan status
  UPDATE public.loans 
  SET status = CASE 
    WHEN total_paid >= loan_amount THEN 'PAID'::loan_status
    WHEN total_paid > 0 THEN 'PARTIAL'::loan_status
    ELSE 'OPEN'::loan_status
  END
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for auto-updating loan status
CREATE TRIGGER update_loan_status_on_payment_insert AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_loan_status();
CREATE TRIGGER update_loan_status_on_payment_update AFTER UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_loan_status();
CREATE TRIGGER update_loan_status_on_payment_delete AFTER DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_loan_status();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_people_user_id ON public.people(user_id);
CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_person_id ON public.loans(person_id);
CREATE INDEX idx_payments_loan_id ON public.payments(loan_id);