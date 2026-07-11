-- Starter Rabbit Hole seed content.
-- Inserts 10 top-level questions and a 2-branch follow-up tree to depth 10 for each.

with starter_questions(question, discipline, sort_order) as (
  values
    ('What kind of problems do you keep returning to even when nobody asks you to?', 'Self-knowledge', 1),
    ('Why do some ideas feel instantly alive while others feel like homework?', 'Cognitive science', 2),
    ('What makes a place feel like it belongs to your future?', 'Design', 3),
    ('When do you feel most yourself: building, explaining, observing, or performing?', 'Psychology', 4),
    ('Which hidden systems shape your day more than you realize?', 'Systems thinking', 5),
    ('What kind of beauty do you trust most: order, surprise, simplicity, or intensity?', 'Aesthetics', 6),
    ('What would you study if usefulness did not need to be defended?', 'Philosophy', 7),
    ('Which questions make time disappear for you?', 'Learning', 8),
    ('What do you notice first when you enter a room full of strangers?', 'Social perception', 9),
    ('What pattern in your life might be asking for a better explanation?', 'Reflection', 10)
), inserted_top_questions as (
  insert into public.rabbit_hole_top_questions (question, discipline, sort_order, active)
  select question, discipline, sort_order, true
  from starter_questions sq
  where not exists (
    select 1
    from public.rabbit_hole_top_questions existing
    where existing.question = sq.question
  )
  returning id, question, discipline, sort_order
), top_questions as (
  select id, question, discipline, sort_order
  from inserted_top_questions
  union all
  select existing.id, existing.question, existing.discipline, existing.sort_order
  from public.rabbit_hole_top_questions existing
  join starter_questions sq on sq.question = existing.question
), recursive_tree as (
  select
    tq.id as top_question_id,
    null::uuid as parent_id,
    tq.question,
    0 as depth,
    0 as branch_order,
    array[tq.sort_order::text] as path_key
  from top_questions tq

  union all

  select
    rt.top_question_id,
    null::uuid as parent_id,
    case branch.branch_order
      when 1 then case rt.depth
        when 0 then 'What part of that question feels most personal to you?'
        when 1 then 'Where did that instinct first start showing up?'
        when 2 then 'What would you protect about that interest if nobody else understood it?'
        when 3 then 'Which detail keeps pulling your attention back?'
        when 4 then 'What kind of challenge would make this more alive?'
        when 5 then 'What would you want to test through direct experience?'
        when 6 then 'Who would you want to discuss this with, and why them?'
        when 7 then 'What would change if you gave this curiosity more room?'
        when 8 then 'What small signal would tell you this path is worth continuing?'
        else 'What is the quietest version of this curiosity that still feels true?'
      end
      else case rt.depth
        when 0 then 'What part of that question feels bigger than just you?'
        when 1 then 'What pattern does this reveal across other parts of your life?'
        when 2 then 'What assumption would you need to question next?'
        when 3 then 'What would someone very different from you notice here?'
        when 4 then 'What tradeoff sits underneath this interest?'
        when 5 then 'What evidence would make you rethink your pull toward this?'
        when 6 then 'What larger system might this curiosity belong to?'
        when 7 then 'What would this become if you pursued it for a year?'
        when 8 then 'What would you need to stop doing to follow this honestly?'
        else 'What deeper question is this question trying to become?'
      end,
    rt.depth + 1,
    branch.branch_order,
    rt.path_key || branch.branch_order::text
  from recursive_tree rt
  cross join (values (1), (2)) as branch(branch_order)
  where rt.depth < 10
), inserted_nodes as (
  insert into public.rabbit_hole_nodes (top_question_id, parent_id, question, depth, branch_order)
  select top_question_id, null, question, depth, branch_order
  from recursive_tree rt
  where not exists (
    select 1
    from public.rabbit_hole_nodes existing
    where existing.top_question_id = rt.top_question_id
  )
  returning id, top_question_id, question, depth, branch_order, created_at
), numbered_nodes as (
  select
    n.id,
    n.top_question_id,
    n.depth,
    n.branch_order,
    row_number() over (partition by n.top_question_id, n.depth order by n.created_at, n.id) as level_position
  from inserted_nodes n
), parent_links as (
  select
    child.id as child_id,
    parent.id as parent_id
  from numbered_nodes child
  join numbered_nodes parent
    on parent.top_question_id = child.top_question_id
   and parent.depth = child.depth - 1
   and parent.level_position = ((child.level_position + 1) / 2)
  where child.depth > 0
)
update public.rabbit_hole_nodes node
set parent_id = parent_links.parent_id
from parent_links
where node.id = parent_links.child_id;
