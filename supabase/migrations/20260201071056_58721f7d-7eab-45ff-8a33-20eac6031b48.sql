-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_loan_status()
RETURNS TRIGGER AS $$
DECLARE
  loan_amount DECIMAL(12, 2);
  total_paid DECIMAL(12, 2);
BEGIN
  SELECT amount INTO loan_amount FROM public.loans WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  SELECT COALESCE(SUM(amount), 0) INTO total_paid 
  FROM public.payments 
  WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  UPDATE public.loans 
  SET status = CASE 
    WHEN total_paid >= loan_amount THEN 'PAID'::loan_status
    WHEN total_paid > 0 THEN 'PARTIAL'::loan_status
    ELSE 'OPEN'::loan_status
  END
  WHERE id = COALESCE(NEW.loan_id, OLD.loan_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;