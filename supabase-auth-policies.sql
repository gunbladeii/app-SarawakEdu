-- Run this after Google Auth is confirmed working.
-- It changes dashboard reads from public anon access to signed-in users only.

drop policy if exists "dashboard read schools" on public.schools;
drop policy if exists "dashboard read student risks" on public.student_risks;
drop policy if exists "dashboard read intervention channels" on public.intervention_channels;
drop policy if exists "authenticated read schools" on public.schools;
drop policy if exists "authenticated read student risks" on public.student_risks;
drop policy if exists "authenticated read intervention channels" on public.intervention_channels;

revoke select on public.schools from anon;
revoke select on public.student_risks from anon;
revoke select on public.intervention_channels from anon;
revoke select on public.dashboard_student_risks from anon;

grant select on public.schools to authenticated;
grant select on public.student_risks to authenticated;
grant select on public.intervention_channels to authenticated;
grant select on public.dashboard_student_risks to authenticated;

alter view public.dashboard_student_risks set (security_invoker = true);

create policy "authenticated read schools"
  on public.schools for select
  to authenticated
  using (true);

create policy "authenticated read student risks"
  on public.student_risks for select
  to authenticated
  using (true);

create policy "authenticated read intervention channels"
  on public.intervention_channels for select
  to authenticated
  using (true);
