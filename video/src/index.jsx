import React from "react";
import {
  AbsoluteFill,
  Composition,
  OffthreadVideo,
  Sequence,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
} from "remotion";
import chapters from "../chapters.json";

function Chapter({ chapter, number }) {
  const frame = useCurrentFrame();
  const total = chapter.seconds * 30;
  const enter = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const focus = [3, 5, 6].includes(number);
  const zoom = focus
    ? interpolate(frame, [0, 90, total - 90, total], [1, 1.04, 1.04, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  return (
    <AbsoluteFill
      style={{
        fontFamily: "Arial, sans-serif",
        color: "#f1f0ec",
        background: "radial-gradient(ellipse at 80% 10%, #1a2445 0%, #0b0d15 48%, #050607 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 27,
          left: 60,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 5 }}>RECTIFY</span>
        <span style={{ width: 1, height: 28, background: "#404657" }} />
        <span
          style={{ fontSize: 28, opacity: enter, transform: `translateY(${(1 - enter) * 8}px)` }}
        >
          {chapter.title}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 62,
          top: 37,
          fontSize: 13,
          letterSpacing: 2,
          color: "#aeb9d6",
        }}
      >
        {number === 0 ? "PRODUCT WALKTHROUGH" : "LOCAL FIXTURE · REAL MODEL"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 84,
          height: 910,
          border: "1px solid #353b4c",
          borderRadius: 17,
          overflow: "hidden",
          boxShadow: "0 25px 80px #0009",
          background: "#030403",
        }}
      >
        <div
          style={{
            height: 34,
            background: "#171b25",
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: 16,
          }}
        >
          {["#df7777", "#d4b46c", "#78b7a0"].map((color) => (
            <span key={color} style={{ background: color, width: 8, height: 8, borderRadius: 9 }} />
          ))}
          <span style={{ marginLeft: 18, fontSize: 12, color: "#bbc0cd", letterSpacing: 0.5 }}>
            {[4, 6].includes(number)
              ? "ReportDesk · local demonstration"
              : "Rectify · local demonstration"}
          </span>
        </div>
        <div style={{ height: 876, overflow: "hidden" }}>
          <OffthreadVideo
            muted
            src={staticFile(`prepared/${chapter.id}.mp4`)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: `scale(${zoom})`,
              transformOrigin: number === 5 ? "72% 45%" : "50% 45%",
            }}
          />
        </div>
      </div>
      <div style={{ position: "absolute", left: 62, top: 1020, fontSize: 20, color: "#b8c1d6" }}>
        {chapter.subtitle}
      </div>
      <div style={{ position: "absolute", right: 62, top: 1023, display: "flex", gap: 10 }}>
        {chapters.map((item, index) => (
          <span
            key={item.id}
            style={{
              width: index === number ? 52 : 18,
              height: 4,
              borderRadius: 4,
              background: index === number ? "#8ca9ff" : index < number ? "#566784" : "#2d3545",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Demo() {
  let offset = 0;
  return (
    <AbsoluteFill>
      {chapters.map((chapter, number) => {
        const start = offset;
        offset += chapter.seconds * 30;
        return (
          <Sequence key={chapter.id} from={start} durationInFrames={chapter.seconds * 30}>
            <Chapter chapter={chapter} number={number} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition
    id="RectifyDemo"
    component={Demo}
    durationInFrames={3600}
    fps={30}
    width={1920}
    height={1080}
  />
));
