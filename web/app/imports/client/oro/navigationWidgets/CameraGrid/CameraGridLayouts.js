/**
 * Camera Grid Layouts
 * Defines constants and functions with which to generate camera grid layouts to be shown
 * in navigation detail.
 */
import { isArray } from 'lodash';

// Amount of rows the responsive grid can display, this number is used as a baseline
// to manage the height of the camera rows inside the grid
const RESPONSIVE_ROWS = 12;

// Amount of columns the responsive grid can display, this number is used as a baseline
// to manage the amount of columns the camera grid will have within its width
const RESPONSIVE_COLUMNS = 3;

/**
 * Returns a layout with two cameras per row
 * @param {array} cameras
 */
const twoCamerasPerRowLayout = cameras => (
  cameras.map((cam, ix) => (
    {
      // Assign the x position depending if index is odd or not
      x: ix % 2 === 0 ? 0 : RESPONSIVE_COLUMNS / 2,
      // y position does not need calculation, since responsive grid layout
      // is going to stack it properly
      y: 0,
      w: RESPONSIVE_COLUMNS / 2,
      // Calculate the height of each camera by dividing layout rows (RESPONSIVE_ROWS) by the amount
      // of camera rows
      h: RESPONSIVE_ROWS / Math.ceil(cameras.length / 2),
      i: cam.id ? cam.id.toString() : ix.toString()
    }
  ))
);

/**
 * Returns a layout with three cameras per row
 * @param {array} cameras
 */
const threeCamerasPerRowLayout = cameras => (
  cameras.map((cam, ix) => (
    {
      // Assign the x position splitting it into 3 columns
      x: ix % 3,
      // y position does not need calculation, since responsive grid layout
      // is going to stack it properly
      y: 0,
      w: 1,
      h: RESPONSIVE_ROWS / Math.ceil(cameras.length / RESPONSIVE_COLUMNS),
      i: cam.id ? cam.id.toString() : ix.toString()
    }
  ))
);

/**
 * Receives an array of cameras and returns the react-grid-layout
 * according to that amount of cameras.
 * @param {array} cameras
 */
const generateCamerasLayout = (cameras) => {
  if (isArray(cameras) && cameras.length) {
    switch (cameras.length) {
      case 0:
        return false;
      case 1: //  One camera layout
        return ([
          {
            x: 0,
            y: 0,
            w: RESPONSIVE_COLUMNS,
            h: RESPONSIVE_ROWS,
            i: cameras[0].id ? cameras[0].id.toString() : 'Camera 1'
          }
        ]);
      case 2: //  Two camera layout - layout is split in "two columns"
        return ([
          {
            x: 0,
            y: 0,
            w: RESPONSIVE_COLUMNS / 2,
            h: RESPONSIVE_ROWS,
            i: cameras[0].id ? cameras[0].id.toString() : 'Camera 1'
          },
          {
            x: RESPONSIVE_COLUMNS / 2,
            y: 0,
            w: RESPONSIVE_COLUMNS / 2,
            h: RESPONSIVE_ROWS,
            i: cameras[1].id ? cameras[1].id.toString() : 'Camera 2'
          },
        ]);
      // Three camera layout
      // The first camera uses all the container width
      // The other two cameras are displayed below
      case 3:
        return ([
          {
            x: 0,
            y: 0,
            w: RESPONSIVE_COLUMNS,
            h: RESPONSIVE_ROWS / 2,
            i: cameras[0].id ? cameras[0].id.toString() : 'Camera 1'
          },
          {
            x: 0,
            y: 6,
            w: RESPONSIVE_COLUMNS / 2,
            h: RESPONSIVE_ROWS / 2,
            i: cameras[1].id ? cameras[1].id.toString() : 'Camera 2'
          },
          {
            x: RESPONSIVE_COLUMNS / 2,
            y: 6,
            w: RESPONSIVE_COLUMNS / 2,
            h: RESPONSIVE_ROWS / 2,
            i: cameras[2].id ? cameras[2].id.toString() : 'Camera 3'
          }
        ]);
      // 4, 5, 6 cameras return a grid with 2 cameras per row
      case 4:
      case 5:
      case 6:
        return twoCamerasPerRowLayout(cameras);
      // 7 or more cameras return a grid with 3 cameras per row
      default:
        return threeCamerasPerRowLayout(cameras);
    }
  } else {
    return false;
  }
};

export { generateCamerasLayout, RESPONSIVE_ROWS, RESPONSIVE_COLUMNS };
