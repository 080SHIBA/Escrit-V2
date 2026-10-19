const choices = ['Buy', 'Sell', 'Escrow links'];

export default function IntentPills({ value, onChange, firstButtonRef }) {
  function toggle(choice) {
    onChange(value.includes(choice) ? value.filter((item) => item !== choice) : [...value, choice]);
  }

  return (
    <div className="auth-intents" role="group" aria-label="What would you like to do?">
      {choices.map((choice, index) => (
        <button
          type="button"
          key={choice}
          ref={index === 0 ? firstButtonRef : undefined}
          className={`auth-intent ${value.includes(choice) ? 'is-selected' : ''}`}
          aria-pressed={value.includes(choice)}
          onClick={() => toggle(choice)}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}
