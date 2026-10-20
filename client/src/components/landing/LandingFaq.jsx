const QUESTIONS = [
  {
    id: 'terms',
    question: 'What terms should I agree on before an escrow payment?',
    answer: 'Agree on what is being sold, the price, delivery or completion details, and any important conditions. Review the terms in your Escrit link before paying.',
  },
  {
    question: 'When does the seller receive payment?',
    answer: 'For escrow purchases, payment is held while the seller completes the agreed delivery. After you confirm, funds are released. If you do not respond, the default release window applies. Listings may also offer payment without escrow.',
  },
  {
    question: 'What happens if something goes wrong?',
    answer: 'Raise a dispute through the transaction before release. The funds are frozen while the issue is reviewed and resolved.',
  },
  {
    question: 'Can I use Escrit for a deal I found somewhere else?',
    answer: 'Yes. Agree on the transaction, create an Escrit escrow link, and share it with the other party so they can review the terms before joining.',
  },
  {
    id: 'privacy',
    question: 'What should I know about privacy and seller verification?',
    answer: 'Escrit asks sellers to complete identity checks and keeps transaction information within the account and escrow journey. Only share information that is needed for the transaction, and review the privacy information provided by Escrit before submitting personal details.',
  },
];

export default function LandingFaq() {
  return (
    <section id="faq" className="landing-section landing-faq landing-anchor">
      <div className="landing-container landing-faq-grid">
        <div className="landing-section-heading">
          <p className="landing-overline">Help centre</p>
          <h2>Good questions, answered.</h2>
          <p>Start here for the basics of browsing and escrow.</p>
        </div>
        <div className="landing-faq-list">
          {QUESTIONS.map(({ id, question, answer }) => (
            <details className="landing-faq-item" key={question} id={id}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
