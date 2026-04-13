let ioInstance = null;

export const setSocketInstance = (io) => {
  ioInstance = io;
};

export const getSocketInstance = () => {
  return ioInstance;
};

export const emitGlobal = (event, payload) => {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
};

export const emitRoom = (room, event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(room).emit(event, payload);
};