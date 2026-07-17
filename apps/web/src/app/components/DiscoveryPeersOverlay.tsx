import { useEffect, useMemo, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

export type DiscoveryPeer = {
  id: string;
  username: string;
  avatarUrl?: string;
};

type DiscoveryZone = "edge" | "page";

type RectBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type Point = {
  x: number;
  y: number;
};

type FloatingPeerCard = {
  peer: DiscoveryPeer;
  zone: DiscoveryZone;
  x: number;
  y: number;
};

type DiscoveryPeersOverlayProps = {
  peers: DiscoveryPeer[];
  anchorRef: RefObject<HTMLElement | null>;
  edgeSpawnLimit: number;
  placementSeed: number;
  className?: string;
};

const FLOATING_CARD_WIDTH = 184;
const FLOATING_CARD_HEIGHT = 64;
const EDGE_CARD_OVERLAP = 14;
const EDGE_CARD_GAP = 12;
const PAGE_CARD_GAP = 22;
const PAGE_CARD_PADDING = 16;
const CARD_CONTENT_SAFE_INSET_X = 44;
const CARD_CONTENT_SAFE_INSET_Y = 54;
const PAGE_CARD_EXCLUSION_MARGIN = 40;
const EDGE_MIN_DISTANCE = 210;
const PAGE_MIN_DISTANCE = 250;
const EDGE_CANDIDATE_COUNT = 72;
const PAGE_CANDIDATE_COUNT = 120;

/**
 * Creates a stable unsigned hash for arbitrary strings.
 *
 * @param value - Input string to hash.
 * @returns Unsigned 32-bit hash.
 */
function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return hash >>> 0;
}

/**
 * Combines a base seed with a deterministic salt.
 *
 * @param seed - Base random seed.
 * @param salt - Stable context key used to branch randomness.
 * @returns Mixed unsigned seed value.
 */
function mixSeed(seed: number, salt: string): number {
  return (seed ^ hashString(salt) ^ 0x9e3779b9) >>> 0;
}

/**
 * Builds a deterministic pseudo-random generator from a seed.
 *
 * @param seed - Seed value.
 * @returns Function that returns random values in the [0, 1) range.
 */
function createSeededRng(seed: number): () => number {
  let state = seed + 0x6d2b79f5;

  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a pseudo-random number within a numeric range.
 *
 * @param rng - Seeded random generator.
 * @param min - Lower inclusive bound.
 * @param max - Upper exclusive bound.
 * @returns Random number in [min, max).
 */
function randomBetween(rng: () => number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }

  return min + rng() * (max - min);
}

/**
 * Builds a rectangle from center point and dimensions.
 *
 * @param x - Center X coordinate.
 * @param y - Center Y coordinate.
 * @param width - Rectangle width.
 * @param height - Rectangle height.
 * @returns Rectangle bounds.
 */
function buildRectFromCenter(x: number, y: number, width: number, height: number): RectBounds {
  return {
    left: x - width / 2,
    top: y - height / 2,
    right: x + width / 2,
    bottom: y + height / 2,
  };
}

/**
 * Shrinks a rectangle by horizontal/vertical inset amounts.
 *
 * @param rect - Source bounds.
 * @param insetX - Horizontal inset size.
 * @param insetY - Vertical inset size.
 * @returns Inset rectangle.
 */
function insetRect(rect: RectBounds, insetX: number, insetY: number): RectBounds {
  return {
    left: rect.left + insetX,
    top: rect.top + insetY,
    right: rect.right - insetX,
    bottom: rect.bottom - insetY,
  };
}

/**
 * Expands a rectangle by a margin on all sides.
 *
 * @param rect - Source bounds.
 * @param margin - Expansion margin.
 * @returns Expanded rectangle.
 */
function expandRect(rect: RectBounds, margin: number): RectBounds {
  return {
    left: rect.left - margin,
    top: rect.top - margin,
    right: rect.right + margin,
    bottom: rect.bottom + margin,
  };
}

/**
 * Tests whether two rectangles overlap.
 *
 * @param a - First rectangle.
 * @param b - Second rectangle.
 * @returns True if the rectangles intersect.
 */
function intersectsRect(a: RectBounds, b: RectBounds): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/**
 * Checks if a rectangle fits inside the viewport with padding.
 *
 * @param rect - Candidate rectangle.
 * @param width - Viewport width.
 * @param height - Viewport height.
 * @param padding - Safe inset from viewport edges.
 * @returns True when the rectangle is fully visible.
 */
function isInsideViewport(
  rect: RectBounds,
  width: number,
  height: number,
  padding: number,
): boolean {
  return (
    rect.left >= padding &&
    rect.top >= padding &&
    rect.right <= width - padding &&
    rect.bottom <= height - padding
  );
}

/**
 * Computes squared Euclidean distance between two points.
 * Squared distance is used to avoid unnecessary square roots during scoring.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns Squared distance value.
 */
function squaredDistance(a: Point, b: Point): number {
  const deltaX = a.x - b.x;
  const deltaY = a.y - b.y;

  return deltaX * deltaX + deltaY * deltaY;
}

/**
 * Finds the closest squared distance from a candidate point to a point set.
 *
 * @param candidate - Candidate point.
 * @param points - Already accepted placement centers.
 * @returns Closest squared distance, or Infinity for an empty set.
 */
function getClosestDistanceSquared(candidate: Point, points: Point[]): number {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const distance = squaredDistance(candidate, point);

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

/**
 * Creates an edge-anchored candidate position around the main role card.
 *
 * @param rng - Seeded random generator.
 * @param cardRect - Main card bounds.
 * @param sideShift - Deterministic side offset.
 * @param attempt - Current attempt index.
 * @returns Candidate point near one card edge.
 */
function buildEdgeCandidate(
  rng: () => number,
  cardRect: RectBounds,
  sideShift: number,
  attempt: number,
): Point {
  const side = (sideShift + attempt) % 4;

  if (side === 0) {
    return {
      x: randomBetween(
        rng,
        cardRect.left + FLOATING_CARD_WIDTH / 2,
        cardRect.right - FLOATING_CARD_WIDTH / 2,
      ),
      y: cardRect.top + EDGE_CARD_OVERLAP - FLOATING_CARD_HEIGHT / 2,
    };
  }

  if (side === 1) {
    return {
      x: cardRect.right - EDGE_CARD_OVERLAP + FLOATING_CARD_WIDTH / 2,
      y: randomBetween(
        rng,
        cardRect.top + FLOATING_CARD_HEIGHT / 2,
        cardRect.bottom - FLOATING_CARD_HEIGHT / 2,
      ),
    };
  }

  if (side === 2) {
    return {
      x: randomBetween(
        rng,
        cardRect.left + FLOATING_CARD_WIDTH / 2,
        cardRect.right - FLOATING_CARD_WIDTH / 2,
      ),
      y: cardRect.bottom - EDGE_CARD_OVERLAP + FLOATING_CARD_HEIGHT / 2,
    };
  }

  return {
    x: cardRect.left + EDGE_CARD_OVERLAP - FLOATING_CARD_WIDTH / 2,
    y: randomBetween(
      rng,
      cardRect.top + FLOATING_CARD_HEIGHT / 2,
      cardRect.bottom - FLOATING_CARD_HEIGHT / 2,
    ),
  };
}

/**
 * Creates a free-floating page candidate position inside viewport bounds.
 *
 * @param rng - Seeded random generator.
 * @param viewportWidth - Current viewport width.
 * @param viewportHeight - Current viewport height.
 * @returns Candidate point anywhere within safe viewport bounds.
 */
function buildPageCandidate(
  rng: () => number,
  viewportWidth: number,
  viewportHeight: number,
): Point {
  return {
    x: randomBetween(
      rng,
      FLOATING_CARD_WIDTH / 2 + PAGE_CARD_PADDING,
      viewportWidth - FLOATING_CARD_WIDTH / 2 - PAGE_CARD_PADDING,
    ),
    y: randomBetween(
      rng,
      FLOATING_CARD_HEIGHT / 2 + PAGE_CARD_PADDING,
      viewportHeight - FLOATING_CARD_HEIGHT / 2 - PAGE_CARD_PADDING,
    ),
  };
}

/**
 * Derives fallback avatar initials from a username.
 *
 * @param username - Display name.
 * @returns Two-letter initials in uppercase.
 */
function getPeerInitials(username: string): string {
  return username
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

/**
 * Renders the floating discovery-peers overlay and computes deterministic,
 * distance-prioritized placement for edge and page zones.
 *
 * @param props - Overlay props and placement controls.
 * @returns Overlay UI with positioned peer pills.
 */
export function DiscoveryPeersOverlay({
  peers,
  anchorRef,
  edgeSpawnLimit,
  placementSeed,
  className,
}: DiscoveryPeersOverlayProps) {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [anchorRect, setAnchorRect] = useState<RectBounds | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    /**
     * Re-measures viewport and anchor-card bounds used by placement logic.
     * State updates are guarded to avoid unnecessary rerenders.
     */
    const updateMetrics = () => {
      const anchorElement = anchorRef.current;

      if (!anchorElement) {
        return;
      }

      const rect = anchorElement.getBoundingClientRect();

      setViewportSize((current) => {
        const next = { width: window.innerWidth, height: window.innerHeight };

        if (current.width === next.width && current.height === next.height) {
          return current;
        }

        return next;
      });

      setAnchorRect((current) => {
        const next = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };

        if (
          current &&
          current.left === next.left &&
          current.top === next.top &&
          current.right === next.right &&
          current.bottom === next.bottom
        ) {
          return current;
        }

        return next;
      });
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(updateMetrics);
    const anchorElement = anchorRef.current;

    if (anchorElement) {
      resizeObserver.observe(anchorElement);
    }

    window.addEventListener("resize", updateMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [anchorRef]);

  const floatingPeerCards = useMemo<FloatingPeerCard[]>(() => {
    if (!anchorRect || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return [];
    }

    const placedPeerRects: RectBounds[] = [];
    const placedCenters: Point[] = [];
    const placements: FloatingPeerCard[] = [];
    const cardContentSafeRect = insetRect(
      anchorRect,
      CARD_CONTENT_SAFE_INSET_X,
      CARD_CONTENT_SAFE_INSET_Y,
    );
    const pageExclusionRect = expandRect(anchorRect, PAGE_CARD_EXCLUSION_MARGIN);

    peers.forEach((peer, index) => {
      const zone: DiscoveryZone = index < edgeSpawnLimit ? "edge" : "page";
      const gap = zone === "edge" ? EDGE_CARD_GAP : PAGE_CARD_GAP;
      const preferredDistance = zone === "edge" ? EDGE_MIN_DISTANCE : PAGE_MIN_DISTANCE;
      const candidateCount = zone === "edge" ? EDGE_CANDIDATE_COUNT : PAGE_CANDIDATE_COUNT;
      const peerSeed = mixSeed(placementSeed, `${peer.id}:${index}:${zone}`);
      const rng = createSeededRng(peerSeed);
      const sideShift = Math.floor(rng() * 4);

      let bestCandidate: Point | null = null;
      let bestRect: RectBounds | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (let attempt = 0; attempt < candidateCount; attempt += 1) {
        const candidate =
          zone === "edge"
            ? buildEdgeCandidate(rng, anchorRect, sideShift, attempt)
            : buildPageCandidate(rng, viewportSize.width, viewportSize.height);

        const candidateRect = buildRectFromCenter(
          candidate.x,
          candidate.y,
          FLOATING_CARD_WIDTH,
          FLOATING_CARD_HEIGHT,
        );

        if (
          !isInsideViewport(
            candidateRect,
            viewportSize.width,
            viewportSize.height,
            PAGE_CARD_PADDING,
          )
        ) {
          continue;
        }

        if (zone === "edge" && intersectsRect(candidateRect, cardContentSafeRect)) {
          continue;
        }

        if (zone === "page" && intersectsRect(candidateRect, pageExclusionRect)) {
          continue;
        }

        const isTooCloseToOtherCards = placedPeerRects.some((existingRect) =>
          intersectsRect(expandRect(candidateRect, gap), existingRect),
        );

        if (isTooCloseToOtherCards) {
          continue;
        }

        const closestDistanceSquared = getClosestDistanceSquared(candidate, placedCenters);
        const closestDistance = Math.sqrt(closestDistanceSquared);

        const minimumDistanceThreshold =
          preferredDistance - (preferredDistance * 0.35 * attempt) / candidateCount;

        if (closestDistance < minimumDistanceThreshold) {
          continue;
        }

        const candidateScore = closestDistanceSquared;

        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestCandidate = candidate;
          bestRect = candidateRect;
        }
      }

      if (!bestCandidate || !bestRect) {
        return;
      }

      placedPeerRects.push(bestRect);
      placedCenters.push(bestCandidate);
      placements.push({
        peer,
        zone,
        x: bestCandidate.x,
        y: bestCandidate.y,
      });
    });

    return placements;
  }, [anchorRect, edgeSpawnLimit, peers, placementSeed, viewportSize.height, viewportSize.width]);

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 z-20 hidden lg:block", className)}
    >
      {floatingPeerCards.map(({ peer, x, y, zone }) => (
        <div
          key={peer.id}
          className="absolute"
          style={{
            left: `${x}px`,
            top: `${y}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <article
            className={cn(
              "pointer-events-auto flex min-w-46 items-center gap-2 rounded-2xl border border-border/80 bg-card/95 px-2.5 py-2 whitespace-nowrap shadow-lg shadow-black/10 backdrop-blur-sm transition-colors duration-200",
              zone === "page" && "bg-card/90",
            )}
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border/80">
              {peer.avatarUrl ? (
                <img
                  src={peer.avatarUrl}
                  alt={`${peer.username} profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold text-muted-foreground">
                  {getPeerInitials(peer.username)}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="max-w-32 truncate text-sm font-semibold whitespace-nowrap text-foreground">
                {peer.username}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest whitespace-nowrap text-muted-foreground">
                Nearby peer
              </p>
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
