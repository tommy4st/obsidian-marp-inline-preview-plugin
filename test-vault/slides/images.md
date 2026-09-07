---
marp: true
theme: default
---

# Image test deck

A vault-relative image (resolved through Obsidian's resource loader):

![relative](../attachments/test-image.svg)

---

## Same image, sibling-folder path

This slide references the same file using a folder-prefixed path.

![sibling](attachments/test-image.svg)

---

## External image

Loaded over HTTPS — should also display.

![h:100px](https://upload.wikimedia.org/wikipedia/commons/1/10/2023_Obsidian_logo.svg)

---

## Local background image

This slide uses a vault-relative image as the background via `![bg](...)`.

![bg](../attachments/test-image.svg)

# Background Slide

Text rendered over local background image.

---

## Split background image

This slide uses a split background via `![bg right:40% fit](...)`.

![bg right:40% fit](attachments/test-image.svg)

# Split Background

Text beside the local background image.
