type SectionHeadingProps = {
  label?: string;
  title: string;
  align?: 'left' | 'center';
};

export function SectionHeading({ label, title, align = 'left' }: SectionHeadingProps) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      {label ? <p className="portal-section-label mb-1">{label}</p> : null}
      <h2 className="portal-section-title">{title}</h2>
      <div
        className={[
          'mt-2 h-0.5 w-12 bg-[var(--gk-red)]',
          align === 'center' ? 'mx-auto' : ''
        ].join(' ')}
        aria-hidden
      />
    </div>
  );
}

export default SectionHeading;
