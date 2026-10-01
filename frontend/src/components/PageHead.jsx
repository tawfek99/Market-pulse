export default function PageHead({ title, subtitle, right }) {
  return (
    <div className="page-head">
      <div>
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {right && <div className="page-head-right">{right}</div>}
    </div>
  );
}
