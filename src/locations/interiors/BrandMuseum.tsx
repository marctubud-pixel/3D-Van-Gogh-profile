import { BrushText, Doodle, Frame, Icon, Plaque, Thumb, sectionsOf, taglineOf, type InteriorProps } from './common'

export function BrandMuseum({ location, projects, onOpenProject }: InteriorProps) {
  const sections = sectionsOf(location, projects)
  return (
    <Frame kind="screen">
      <Plaque title={location.name} sub={taglineOf(location)} />
      <div className="screen" style={{ ['--panels' as string]: Math.max(1, sections.length) }}>
        {sections.map((s) => {
          const lead = s.projects[0]
          return (
            <section key={s.name} className="screen-panel">
              <h2 className="screen-label">
                <Icon name={s.name} />
                <BrushText text={s.name} size={26} />
              </h2>
              {lead ? <Thumb project={lead} /> : <div className="int-thumb blank"><Icon name={s.name} /></div>}
              <p className="screen-desc">{lead ? lead.subtitle || lead.title : '案例整理中'}</p>
              {s.projects.length > 1 && (
                <ul className="screen-more">
                  {s.projects.slice(1, 4).map((p) => (
                    <li key={p.id}>
                      <button onClick={() => onOpenProject(p.id)}>{p.title}</button>
                    </li>
                  ))}
                </ul>
              )}
              <button className="int-btn" disabled={!lead} onClick={() => lead && onOpenProject(lead.id)}>
                查看案例 ▶
              </button>
            </section>
          )
        })}
      </div>
      <Doodle className="center">—— 视觉需要策略 ——</Doodle>
    </Frame>
  )
}
