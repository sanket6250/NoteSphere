export const NOTE_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank note',
    description: 'A clean page for whatever is on your mind.',
    icon: 'file',
    title: 'Untitled note',
    content: '<p></p>',
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Capture the conversation and next steps.',
    icon: 'meeting',
    title: 'Meeting notes',
    content: '<h1>Meeting notes</h1><p><strong>Date:</strong> Add date and time</p><p><strong>Participants:</strong> Add participants</p><h2>Agenda</h2><ul><li><p>Add an agenda item</p></li></ul><h2>Discussion</h2><p>Capture the key points…</p><h2>Decisions</h2><ul><li><p>Record a decision</p></li></ul><h2>Action items</h2><ul><li><p>Add an action item and owner</p></li></ul>',
  },
  {
    id: 'journal',
    name: 'Daily journal',
    description: 'Make a little room to reflect on your day.',
    icon: 'journal',
    title: 'Daily journal',
    content: '<h1>Today</h1><p><strong>Date:</strong> Add today’s date</p><h2>Highlights</h2><p>What went well today?</p><h2>Thoughts</h2><p>What is on your mind?</p><h2>Gratitude</h2><ul><li><p>One thing I appreciate…</p></li></ul>',
  },
  {
    id: 'todo',
    name: 'To-do list',
    description: 'Turn your next steps into a clear list.',
    icon: 'todo',
    title: 'To-do list',
    content: '<h1>To-do list</h1><p><strong>Priority:</strong> Choose a priority</p><p><strong>Due date:</strong> Add a due date</p><h2>Tasks</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Add your first task</p></div></li></ul>',
  },
  {
    id: 'project',
    name: 'Project notes',
    description: 'Bring the plan, progress, and details together.',
    icon: 'project',
    title: 'Project notes',
    content: '<h1>Project overview</h1><p><strong>Project:</strong> Add a name</p><h2>Objective</h2><p>What are we trying to accomplish?</p><h2>Requirements</h2><ul><li><p>Add a requirement</p></li></ul><h2>Progress</h2><p>What has happened so far?</p><h2>Important links</h2><p>Add useful links…</p><h2>Notes</h2><p></p>',
  },
  {
    id: 'study',
    name: 'Study notes',
    description: 'Organize a topic, the key ideas, and examples.',
    icon: 'study',
    title: 'Study notes',
    content: '<h1>Study notes</h1><p><strong>Subject:</strong> Add a subject</p><p><strong>Topic:</strong> Add a topic</p><h2>Key concepts</h2><ul><li><p>Write down a key concept</p></li></ul><h2>Examples</h2><p>Add an example that makes the concept click…</p><h2>Questions</h2><ul><li><p>What do I still want to understand?</p></li></ul><h2>References</h2><p>Add a source…</p>',
  },
  {
    id: 'technical',
    name: 'Technical documentation',
    description: 'Explain a system, process, or implementation.',
    icon: 'technical',
    title: 'Technical notes',
    content: '<h1>Technical notes</h1><p><strong>System or topic:</strong> Add a name</p><h2>Overview</h2><p>Describe the system or change…</p><h2>Requirements</h2><ul><li><p>Add a requirement</p></li></ul><h2>Implementation</h2><pre><code>// Add an example or code snippet</code></pre><h2>Decisions and trade-offs</h2><p></p><h2>References</h2><p>Add useful links…</p>',
  },
  {
    id: 'quick',
    name: 'Quick note',
    description: 'Get an idea down before it gets away.',
    icon: 'quick',
    title: 'Quick note',
    content: '<p></p>',
  },
];

export function getNoteTemplate(type) {
  return NOTE_TEMPLATES.find((template) => template.id === type) || NOTE_TEMPLATES[0];
}
