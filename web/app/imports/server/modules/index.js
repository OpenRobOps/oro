/**
 * Here go all the Application-server side module implementations.
 *
 * Note that any functionality added here should be only to manage
 * configuration of modules, but never processing of incoming
 * module data. That part should be added to the ingest service
 */
// export { default as SystemModule } from './system';
// export { default as RobotLocalizationModule } from './localization';
// export { default as CustomDataModule } from './customData';
// export { default as RosMonitorModule } from './rosMonitor';
// export { default as ImagesModule } from './images';
export { default as Navigation2DModule } from './nav2d';