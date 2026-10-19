const TYPES = [
  ['all', 'All'],
  ['product', 'Products'],
  ['service', 'Services'],
  ['course', 'Courses'],
];

export default function TypeSwitch({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Listing type">
      {TYPES.map(([type, label]) => (
        <button
          key={type}
          type="button"
          aria-pressed={value === type}
          onClick={() => onChange(type)}
          className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${
            value === type ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink/70 hover:border-accent/50 hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
