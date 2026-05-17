from viewer.proposals import extract_proposal_excerpt


def test_extract_proposal_excerpt_skips_yaml_frontmatter() -> None:
    content = """---
title: Metadata title
status: Draft proposal
---

# Proposal title

This is the first narrative paragraph.
"""

    assert extract_proposal_excerpt(content) == "This is the first narrative paragraph."


def test_extract_proposal_excerpt_keeps_body_after_inline_status_heading() -> None:
    content = """# Proposal title

## Status: Draft proposal

This body paragraph should still become the preview.
"""

    assert extract_proposal_excerpt(content) == "This body paragraph should still become the preview."


def test_extract_proposal_excerpt_skips_fenced_code_body() -> None:
    content = """# Proposal title

```yaml
status: metadata-like code
title: code block
```

Use this proposal to connect runtime traces to graph context.
"""

    assert (
        extract_proposal_excerpt(content)
        == "Use this proposal to connect runtime traces to graph context."
    )
