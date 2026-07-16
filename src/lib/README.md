# lib/ — pure helpers, no domain knowledge

**May live here:** generic, pure utilities (formatting, fractional ranking math,
date helpers) that would make sense in any codebase.

**May not live here:** anything that knows about nodes, links, fields, views, or
the DB. If a helper mentions a domain concept, it belongs in `service/`; if it
queries, it belongs in `repository/`.

Empty in Phase 0 by design.
