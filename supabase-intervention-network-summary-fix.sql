drop view if exists public.dashboard_intervention_network_summary;

create view public.dashboard_intervention_network_summary as
select
  base.stakeholder_type,
  base.owner_label,
  base.action_summary,
  base.sort_order,
  base.total_tasks,
  base.pending_tasks,
  base.active_tasks,
  base.done_tasks,
  base.urgent_tasks
from (
  select
    stakeholder_type,
    case stakeholder_type
      when 'school' then 'Sekolah'
      when 'parent' then 'Ibu bapa'
      when 'community' then 'Ketua kaum / penghulu'
      when 'representative' then 'YB / agensi'
      else 'Pihak berkepentingan'
    end as owner_label,
    case stakeholder_type
      when 'school' then 'Kelas mikro, mentor akademik, semakan markah dan pemantauan kehadiran harian.'
      when 'parent' then 'Sokongan kehadiran, jadual ulang kaji di rumah dan komunikasi berkala dengan sekolah.'
      when 'community' then 'Ziarah cakna bagi kes kehadiran kritikal, sokongan keluarga dan pemantauan komuniti.'
      when 'representative' then 'Sokongan logistik, ruang belajar komuniti, bantuan peranti atau pengangkutan.'
      else 'Tindakan intervensi murid.'
    end as action_summary,
    case stakeholder_type
      when 'school' then 1
      when 'parent' then 2
      when 'community' then 3
      when 'representative' then 4
      else 9
    end as sort_order,
    count(*)::integer as total_tasks,
    sum(case when status in ('pending', 'accepted') then 1 else 0 end)::integer as pending_tasks,
    sum(case when status = 'in_progress' then 1 else 0 end)::integer as active_tasks,
    sum(case when status = 'done' then 1 else 0 end)::integer as done_tasks,
    sum(case when risk = 'red' and status <> 'done' then 1 else 0 end)::integer as urgent_tasks
  from public.intervention_stakeholder_tasks
  group by stakeholder_type
) base;

alter view public.dashboard_intervention_network_summary set (security_invoker = true);

grant select on public.dashboard_intervention_network_summary to authenticated;

notify pgrst, 'reload schema';
