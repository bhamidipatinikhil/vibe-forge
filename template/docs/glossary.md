# Glossary

The ubiquitous language of this project. Keep terms canonical and short; when a term's meaning drifts, add a dated note here instead of rewriting history.

| Term | Meaning |
|---|---|
| module | A product area with its own routes and tables under `src/modules/<name>/` |
| seam | A public interface a module exposes; complexity hides behind it |
| gate | A check that must pass before work ships (`just check`, CI, review) |
