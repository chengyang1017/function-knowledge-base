import { NavLink } from 'react-router-dom';

import './knowledge-kind-tabs.css';

type KnowledgeKindTabsProps = {
  compact?: boolean;
};

function KnowledgeKindTabs({
  compact = false,
}: KnowledgeKindTabsProps) {
  return (
    <nav
      className={
        compact
          ? 'knowledge-kind-tabs compact'
          : 'knowledge-kind-tabs'
      }
      aria-label="代码阅读模式"
    >
      <NavLink
        to="/projects"
        className={({ isActive }) =>
          isActive
            ? 'knowledge-workspace-link active'
            : 'knowledge-workspace-link'
        }
      >
        项目阅读
      </NavLink>

      <span className="knowledge-kind-divider" aria-hidden="true" />

      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          isActive ? 'active' : undefined
        }
      >
        函数
      </NavLink>

      <NavLink
        to="/classes"
        className={({ isActive }) =>
          isActive ? 'active' : undefined
        }
      >
        Class
      </NavLink>

      <NavLink
        to="/files"
        className={({ isActive }) =>
          isActive ? 'active' : undefined
        }
      >
        文件
      </NavLink>
    </nav>
  );
}

export default KnowledgeKindTabs;
