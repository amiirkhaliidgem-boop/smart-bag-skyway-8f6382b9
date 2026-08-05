ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '30s';
DROP FUNCTION IF EXISTS public.qa_raise(text);