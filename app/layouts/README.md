# Resume Layout Blueprints

These JSON files separate layout and writing style from resume content.

The future AI flow should use them like this:

1. Classify the pasted JD as `intern`, `entry`, `junior`, `midlevel`, or `senior`.
2. Load the matching JSON blueprint.
3. Generate structured resume JSON using the JD and selected candidate mode.
4. Render the final resume with code so fonts, spacing, alignment, bullets, and section order stay consistent.

The source resumes are layout references only. Company names, dates, links, identities, metrics, and project claims from those files should not be copied unless supplied separately as candidate data or selected example data.
