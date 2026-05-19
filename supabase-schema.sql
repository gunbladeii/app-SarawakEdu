create extension if not exists pgcrypto;

do $$
begin
  create type public.risk_level as enum ('red', 'amber', 'green');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  district text not null default 'Serian',
  candidates integer not null default 0 check (candidates >= 0),
  pass_forecast numeric(5,2) not null default 0 check (pass_forecast between 0 and 100),
  attendance_avg numeric(5,2) not null default 0 check (attendance_avg between 0 and 100),
  gpa numeric(4,2) not null default 0 check (gpa >= 0),
  red_count integer not null default 0 check (red_count >= 0),
  amber_count integer not null default 0 check (amber_count >= 0),
  critical_subject text not null default '-',
  updated_at timestamptz not null default now()
);

create table if not exists public.student_risks (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  name text not null,
  school_code text not null references public.schools(code) on update cascade on delete restrict,
  risk public.risk_level not null default 'green',
  issue text not null default '-',
  intervention text not null default '-',
  attendance_rate numeric(5,2) check (attendance_rate between 0 and 100),
  last_reviewed date not null default current_date,
  updated_at timestamptz not null default now()
);

create table if not exists public.intervention_channels (
  id uuid primary key default gen_random_uuid(),
  owner text not null unique,
  action text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace view public.dashboard_student_risks as
select
  sr.id,
  sr.student_code,
  sr.name,
  s.name as school,
  sr.risk::text as risk,
  sr.issue,
  sr.intervention,
  sr.attendance_rate,
  sr.last_reviewed,
  sr.updated_at
from public.student_risks sr
join public.schools s on s.code = sr.school_code;

alter table public.schools enable row level security;
alter table public.student_risks enable row level security;
alter table public.intervention_channels enable row level security;

drop policy if exists "dashboard read schools" on public.schools;
drop policy if exists "dashboard read student risks" on public.student_risks;
drop policy if exists "dashboard read intervention channels" on public.intervention_channels;

create policy "dashboard read schools"
  on public.schools for select
  using (true);

create policy "dashboard read student risks"
  on public.student_risks for select
  using (true);

create policy "dashboard read intervention channels"
  on public.intervention_channels for select
  using (true);

grant usage on schema public to anon, authenticated;
grant select on public.schools to anon, authenticated;
grant select on public.student_risks to anon, authenticated;
grant select on public.intervention_channels to anon, authenticated;
grant select on public.dashboard_student_risks to anon, authenticated;
