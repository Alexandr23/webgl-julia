import React from "react";

import { CopRenderer } from "./CopRenderer";

export const Cop = () => {
  const parentElementRef = React.useRef<HTMLDivElement | null>(null);
  const [isStarted, setIsStarted] = React.useState(false);
  const worldRef = React.useRef<CopRenderer>();

  const handleStart = React.useCallback(() => {
    setIsStarted(true);

    worldRef.current = new CopRenderer({});
  }, [isStarted]);

  return (
    <>
      <Video name="jv1" />
      <Video name="jv2" />
      <Video name="jv3" />
      <Video name="jv4" />
      <Video name="jv5" />

      {!isStarted && (
        <button className="button start-button" onClick={handleStart}>
          Happy Birthday
        </button>
      )}
    </>
  );
};

type VideoProps = {
  name: string;
};

const Video: React.FC<VideoProps> = ({ name }) => {
  return (
    <video
      src={`./content/j/${name}.mp4`}
      autoPlay
      loop
      id={name}
      muted
      style={{ position: "absolute", zIndex: -1 }}
      width={1}
      height={1}
    />
  );
};
