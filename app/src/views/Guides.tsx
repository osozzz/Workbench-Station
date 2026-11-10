import { Info } from "@phosphor-icons/react";
import { Command } from "../actions";
import { guideById, groups, guides, type Block, type GuideId } from "../guides";

function GuideBlock({ block }: { block: Block }) {
  if ("text" in block) return <p>{block.text}</p>;
  if ("steps" in block)
    return (
      <ol className="guide-steps">
        {block.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    );
  if ("terms" in block)
    return (
      <dl className="guide-terms">
        {block.terms.map(([term, meaning]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    );
  if ("code" in block) return <Command text={block.code} label="Copy" />;
  return (
    <p className="notice">
      <Info size={20} aria-hidden="true" />
      <span>{block.aside}</span>
    </p>
  );
}

/** Local how-tos: the basics, the updates that need you, and what to do when one fails. */
export function Guides({ guide, onSelect }: { guide: GuideId; onSelect(id: GuideId): void }) {
  const current = guideById.get(guide) ?? guides[0];
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Guides</h1>
      </div>
      <div className="guides">
        <nav className="pane guide-nav" aria-label="Guides">
          {groups.map((group) => (
            <div className="guide-group" key={group.id}>
              <h2 className="group-title">{group.title}</h2>
              <ul>
                {guides
                  .filter((item) => item.group === group.id)
                  .map((item) => (
                    <li key={item.id}>
                      <button className="guide-link" aria-current={item.id === current.id ? "page" : undefined} onClick={() => onSelect(item.id)}>
                        {item.title}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>
        <article className="pane guide" key={current.id} aria-labelledby="guide-title">
          <h2 className="guide-title" id="guide-title">
            {current.title}
          </h2>
          <p className="guide-summary">{current.summary}</p>
          {current.body.map((block, index) => (
            <GuideBlock block={block} key={index} />
          ))}
        </article>
      </div>
    </>
  );
}
