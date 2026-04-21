use skia_safe::{Image, Rect};

use crate::uuid::Uuid;

/// A pre-rasterized texture of a single shape captured at the moment an
/// interactive transform (drag / resize / rotate) starts.
///
/// During the gesture the layer is composed on top of the atlas backdrop by
/// applying the shape's current modifier matrix to the canvas and blitting
/// `image` into `source_doc_rect`. Because `source_doc_rect` is the shape's
/// extrect in document coordinates at capture time, `draw_image_rect` maps
/// the texels to the original footprint and then the modifier transform
/// (concatenated on the canvas) moves / rotates / scales the whole result
/// in one GPU draw call.
pub struct DragLayer {
    /// Shape whose pixels are captured in `image`.
    pub shape_id: Uuid,

    /// Pre-rasterized snapshot of the shape rendered at the current zoom and
    /// without any modifier applied. The image is sized in device pixels and
    /// already includes margins, shadows, blurs and any effect that extends
    /// the shape past its selrect.
    pub image: Image,

    /// Extrect of the shape in document space when the snapshot was taken.
    /// This is the destination rectangle passed to `draw_image_rect`: skia
    /// maps the full image into it and the canvas matrix (zoom + modifier)
    /// takes care of placing the layer on screen.
    pub source_doc_rect: Rect,
}

/// Collection of pre-rasterized layers used to implement the SVG-style
/// "composited preview" during interactive transforms.
///
/// When `active` is true, the render loop short-circuits the full tile
/// rendering pipeline and instead uses the cached images inside `layers`
/// to present a frame: this matches what a browser does with SVG shapes
/// during a drag (raster once, transform the raster).
pub struct DragLayers {
    pub layers: Vec<DragLayer>,
    /// Toggled on by `prepare` once snapshots are captured, and off again by
    /// `clear`. The render loop checks this flag before every frame to pick
    /// between the layered fast path and the normal tile pipeline.
    pub active: bool,
}

impl DragLayers {
    pub fn new() -> Self {
        Self {
            layers: Vec::new(),
            active: false,
        }
    }

    pub fn clear(&mut self) {
        self.layers.clear();
        self.active = false;
    }

    pub fn is_empty(&self) -> bool {
        self.layers.is_empty()
    }

    pub fn push(&mut self, layer: DragLayer) {
        self.layers.push(layer);
    }

    pub fn iter(&self) -> std::slice::Iter<'_, DragLayer> {
        self.layers.iter()
    }
}

impl Default for DragLayers {
    fn default() -> Self {
        Self::new()
    }
}

