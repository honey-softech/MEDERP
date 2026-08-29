/**
 * Sign-off area shared by printed documents. `imageData` must only be passed once the
 * document is actually signed off — an unapproved preview showing a signature is
 * indistinguishable from a real one.
 */
export function SignatureBlock({
  role,
  name,
  credentials,
  imageData,
  note,
  compact,
}: {
  role: string;
  name: string;
  credentials?: string | null;
  imageData?: string | null;
  note?: string | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "vs-sign-compact" : undefined}>
      {role ? <p className="vs-label">{role}</p> : null}
      {imageData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageData} alt="" className="vs-sign-img" />
      ) : null}
      <p className="vs-sign-name">{name}</p>
      {credentials ? <p className="vs-sign-cred">{credentials}</p> : null}
      {note ? <p className="vs-sign-line">{note}</p> : null}
    </div>
  );
}
