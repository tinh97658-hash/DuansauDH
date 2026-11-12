import React, { forwardRef } from "react";
import SvgIcon from "@mui/material/SvgIcon";
import {
  AcademicCapIcon as HeroAcademicCapIcon,
  AdjustmentsHorizontalIcon as HeroAdjustmentsHorizontalIcon,
  ArrowDownIcon as HeroArrowDownIcon,
  ArrowDownOnSquareIcon as HeroArrowDownOnSquareIcon,
  ArrowDownTrayIcon as HeroArrowDownTrayIcon,
  ArrowLeftIcon as HeroArrowLeftIcon,
  ArrowPathIcon as HeroArrowPathIcon,
  ArrowRightIcon as HeroArrowRightIcon,
  ArrowRightEndOnRectangleIcon as HeroArrowRightEndOnRectangleIcon,
  ArrowRightStartOnRectangleIcon as HeroArrowRightStartOnRectangleIcon,
  ArrowUpIcon as HeroArrowUpIcon,
  ArrowUpTrayIcon as HeroArrowUpTrayIcon,
  ArrowsRightLeftIcon as HeroArrowsRightLeftIcon,
  ArrowsUpDownIcon as HeroArrowsUpDownIcon,
  BanknotesIcon as HeroBanknotesIcon,
  Bars3Icon as HeroBars3Icon,
  BookOpenIcon as HeroBookOpenIcon,
  BuildingLibraryIcon as HeroBuildingLibraryIcon,
  BuildingOffice2Icon as HeroBuildingOffice2Icon,
  BuildingOfficeIcon as HeroBuildingOfficeIcon,
  CalendarDateRangeIcon as HeroCalendarDateRangeIcon,
  CalendarDaysIcon as HeroCalendarDaysIcon,
  CalendarIcon as HeroCalendarIcon,
  ChartBarIcon as HeroChartBarIcon,
  CheckBadgeIcon as HeroCheckBadgeIcon,
  CheckCircleIcon as HeroCheckCircleIcon,
  CheckIcon as HeroCheckIcon,
  ChevronDownIcon as HeroChevronDownIcon,
  ChevronLeftIcon as HeroChevronLeftIcon,
  ChevronRightIcon as HeroChevronRightIcon,
  ChevronUpIcon as HeroChevronUpIcon,
  ClipboardDocumentCheckIcon as HeroClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon as HeroClipboardDocumentListIcon,
  ClockIcon as HeroClockIcon,
  Cog6ToothIcon as HeroCog6ToothIcon,
  DocumentChartBarIcon as HeroDocumentChartBarIcon,
  DocumentCheckIcon as HeroDocumentCheckIcon,
  DocumentDuplicateIcon as HeroDocumentDuplicateIcon,
  DocumentIcon as HeroDocumentIcon,
  DocumentPlusIcon as HeroDocumentPlusIcon,
  DocumentTextIcon as HeroDocumentTextIcon,
  EllipsisHorizontalIcon as HeroEllipsisHorizontalIcon,
  EnvelopeIcon as HeroEnvelopeIcon,
  ExclamationTriangleIcon as HeroExclamationTriangleIcon,
  EyeIcon as HeroEyeIcon,
  EyeSlashIcon as HeroEyeSlashIcon,
  FlagIcon as HeroFlagIcon,
  FolderIcon as HeroFolderIcon,
  FolderOpenIcon as HeroFolderOpenIcon,
  HomeModernIcon as HeroHomeModernIcon,
  InformationCircleIcon as HeroInformationCircleIcon,
  KeyIcon as HeroKeyIcon,
  LanguageIcon as HeroLanguageIcon,
  LightBulbIcon as HeroLightBulbIcon,
  LockClosedIcon as HeroLockClosedIcon,
  LockOpenIcon as HeroLockOpenIcon,
  MagnifyingGlassIcon as HeroMagnifyingGlassIcon,
  MapPinIcon as HeroMapPinIcon,
  MinusIcon as HeroMinusIcon,
  PaperAirplaneIcon as HeroPaperAirplaneIcon,
  PencilSquareIcon as HeroPencilSquareIcon,
  PhoneIcon as HeroPhoneIcon,
  PhotoIcon as HeroPhotoIcon,
  PlusIcon as HeroPlusIcon,
  QueueListIcon as HeroQueueListIcon,
  RectangleStackIcon as HeroRectangleStackIcon,
  ScaleIcon as HeroScaleIcon,
  ShieldCheckIcon as HeroShieldCheckIcon,
  Square3Stack3DIcon as HeroSquare3Stack3DIcon,
  Squares2X2Icon as HeroSquares2X2Icon,
  StopIcon as HeroStopIcon,
  TableCellsIcon as HeroTableCellsIcon,
  TrashIcon as HeroTrashIcon,
  TrophyIcon as HeroTrophyIcon,
  UserCircleIcon as HeroUserCircleIcon,
  UserGroupIcon as HeroUserGroupIcon,
  UserIcon as HeroUserIcon,
  UserPlusIcon as HeroUserPlusIcon,
  UsersIcon as HeroUsersIcon,
  ViewColumnsIcon as HeroViewColumnsIcon,
  XCircleIcon as HeroXCircleIcon,
  XMarkIcon as HeroXMarkIcon,
} from "@heroicons/react/24/outline";

// Keep MUI sizing, theme colours, refs and sx while rendering native Heroicons paths.
function createAppIcon(Icon, name) {
  const AppIcon = forwardRef(function AppIcon({ sx = [], titleAccess, ...props }, ref) {
    return <SvgIcon component={Icon} inheritViewBox ref={ref}
      title={titleAccess} role={titleAccess ? "img" : undefined}
      aria-label={titleAccess} aria-hidden={titleAccess ? false : true}
      data-heroicon={name} {...props}
      sx={[{ fill: "none", verticalAlign: "middle", flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]} />;
  });
  AppIcon.displayName = name;
  return AppIcon;
}

export const AcademicCapIcon = createAppIcon(HeroAcademicCapIcon, "AcademicCapIcon");
export const AdjustmentsHorizontalIcon = createAppIcon(HeroAdjustmentsHorizontalIcon, "AdjustmentsHorizontalIcon");
export const ArrowDownIcon = createAppIcon(HeroArrowDownIcon, "ArrowDownIcon");
export const ArrowDownOnSquareIcon = createAppIcon(HeroArrowDownOnSquareIcon, "ArrowDownOnSquareIcon");
export const ArrowDownTrayIcon = createAppIcon(HeroArrowDownTrayIcon, "ArrowDownTrayIcon");
export const ArrowLeftIcon = createAppIcon(HeroArrowLeftIcon, "ArrowLeftIcon");
export const ArrowPathIcon = createAppIcon(HeroArrowPathIcon, "ArrowPathIcon");
export const ArrowRightIcon = createAppIcon(HeroArrowRightIcon, "ArrowRightIcon");
export const ArrowRightEndOnRectangleIcon = createAppIcon(HeroArrowRightEndOnRectangleIcon, "ArrowRightEndOnRectangleIcon");
export const ArrowRightStartOnRectangleIcon = createAppIcon(HeroArrowRightStartOnRectangleIcon, "ArrowRightStartOnRectangleIcon");
export const ArrowUpIcon = createAppIcon(HeroArrowUpIcon, "ArrowUpIcon");
export const ArrowUpTrayIcon = createAppIcon(HeroArrowUpTrayIcon, "ArrowUpTrayIcon");
export const ArrowsRightLeftIcon = createAppIcon(HeroArrowsRightLeftIcon, "ArrowsRightLeftIcon");
export const ArrowsUpDownIcon = createAppIcon(HeroArrowsUpDownIcon, "ArrowsUpDownIcon");
export const BanknotesIcon = createAppIcon(HeroBanknotesIcon, "BanknotesIcon");
export const Bars3Icon = createAppIcon(HeroBars3Icon, "Bars3Icon");
export const BookOpenIcon = createAppIcon(HeroBookOpenIcon, "BookOpenIcon");
export const BuildingLibraryIcon = createAppIcon(HeroBuildingLibraryIcon, "BuildingLibraryIcon");
export const BuildingOffice2Icon = createAppIcon(HeroBuildingOffice2Icon, "BuildingOffice2Icon");
export const BuildingOfficeIcon = createAppIcon(HeroBuildingOfficeIcon, "BuildingOfficeIcon");
export const CalendarDateRangeIcon = createAppIcon(HeroCalendarDateRangeIcon, "CalendarDateRangeIcon");
export const CalendarDaysIcon = createAppIcon(HeroCalendarDaysIcon, "CalendarDaysIcon");
export const CalendarIcon = createAppIcon(HeroCalendarIcon, "CalendarIcon");
export const ChartBarIcon = createAppIcon(HeroChartBarIcon, "ChartBarIcon");
export const CheckBadgeIcon = createAppIcon(HeroCheckBadgeIcon, "CheckBadgeIcon");
export const CheckCircleIcon = createAppIcon(HeroCheckCircleIcon, "CheckCircleIcon");
export const CheckIcon = createAppIcon(HeroCheckIcon, "CheckIcon");
export const ChevronDownIcon = createAppIcon(HeroChevronDownIcon, "ChevronDownIcon");
export const ChevronLeftIcon = createAppIcon(HeroChevronLeftIcon, "ChevronLeftIcon");
export const ChevronRightIcon = createAppIcon(HeroChevronRightIcon, "ChevronRightIcon");
export const ChevronUpIcon = createAppIcon(HeroChevronUpIcon, "ChevronUpIcon");
export const ClipboardDocumentCheckIcon = createAppIcon(HeroClipboardDocumentCheckIcon, "ClipboardDocumentCheckIcon");
export const ClipboardDocumentListIcon = createAppIcon(HeroClipboardDocumentListIcon, "ClipboardDocumentListIcon");
export const ClockIcon = createAppIcon(HeroClockIcon, "ClockIcon");
export const Cog6ToothIcon = createAppIcon(HeroCog6ToothIcon, "Cog6ToothIcon");
export const DocumentChartBarIcon = createAppIcon(HeroDocumentChartBarIcon, "DocumentChartBarIcon");
export const DocumentCheckIcon = createAppIcon(HeroDocumentCheckIcon, "DocumentCheckIcon");
export const DocumentDuplicateIcon = createAppIcon(HeroDocumentDuplicateIcon, "DocumentDuplicateIcon");
export const DocumentIcon = createAppIcon(HeroDocumentIcon, "DocumentIcon");
export const DocumentPlusIcon = createAppIcon(HeroDocumentPlusIcon, "DocumentPlusIcon");
export const DocumentTextIcon = createAppIcon(HeroDocumentTextIcon, "DocumentTextIcon");
export const EllipsisHorizontalIcon = createAppIcon(HeroEllipsisHorizontalIcon, "EllipsisHorizontalIcon");
export const EnvelopeIcon = createAppIcon(HeroEnvelopeIcon, "EnvelopeIcon");
export const ExclamationTriangleIcon = createAppIcon(HeroExclamationTriangleIcon, "ExclamationTriangleIcon");
export const EyeIcon = createAppIcon(HeroEyeIcon, "EyeIcon");
export const EyeSlashIcon = createAppIcon(HeroEyeSlashIcon, "EyeSlashIcon");
export const FlagIcon = createAppIcon(HeroFlagIcon, "FlagIcon");
export const FolderIcon = createAppIcon(HeroFolderIcon, "FolderIcon");
export const FolderOpenIcon = createAppIcon(HeroFolderOpenIcon, "FolderOpenIcon");
export const HomeModernIcon = createAppIcon(HeroHomeModernIcon, "HomeModernIcon");
export const InformationCircleIcon = createAppIcon(HeroInformationCircleIcon, "InformationCircleIcon");
export const KeyIcon = createAppIcon(HeroKeyIcon, "KeyIcon");
export const LanguageIcon = createAppIcon(HeroLanguageIcon, "LanguageIcon");
export const LightBulbIcon = createAppIcon(HeroLightBulbIcon, "LightBulbIcon");
export const LockClosedIcon = createAppIcon(HeroLockClosedIcon, "LockClosedIcon");
export const LockOpenIcon = createAppIcon(HeroLockOpenIcon, "LockOpenIcon");
export const MagnifyingGlassIcon = createAppIcon(HeroMagnifyingGlassIcon, "MagnifyingGlassIcon");
export const MapPinIcon = createAppIcon(HeroMapPinIcon, "MapPinIcon");
export const MinusIcon = createAppIcon(HeroMinusIcon, "MinusIcon");
export const PaperAirplaneIcon = createAppIcon(HeroPaperAirplaneIcon, "PaperAirplaneIcon");
export const PencilSquareIcon = createAppIcon(HeroPencilSquareIcon, "PencilSquareIcon");
export const PhoneIcon = createAppIcon(HeroPhoneIcon, "PhoneIcon");
export const PhotoIcon = createAppIcon(HeroPhotoIcon, "PhotoIcon");
export const PlusIcon = createAppIcon(HeroPlusIcon, "PlusIcon");
export const QueueListIcon = createAppIcon(HeroQueueListIcon, "QueueListIcon");
export const RectangleStackIcon = createAppIcon(HeroRectangleStackIcon, "RectangleStackIcon");
export const ScaleIcon = createAppIcon(HeroScaleIcon, "ScaleIcon");
export const ShieldCheckIcon = createAppIcon(HeroShieldCheckIcon, "ShieldCheckIcon");
export const Square3Stack3DIcon = createAppIcon(HeroSquare3Stack3DIcon, "Square3Stack3DIcon");
export const Squares2X2Icon = createAppIcon(HeroSquares2X2Icon, "Squares2X2Icon");
export const StopIcon = createAppIcon(HeroStopIcon, "StopIcon");
export const TableCellsIcon = createAppIcon(HeroTableCellsIcon, "TableCellsIcon");
export const TrashIcon = createAppIcon(HeroTrashIcon, "TrashIcon");
export const TrophyIcon = createAppIcon(HeroTrophyIcon, "TrophyIcon");
export const UserCircleIcon = createAppIcon(HeroUserCircleIcon, "UserCircleIcon");
export const UserGroupIcon = createAppIcon(HeroUserGroupIcon, "UserGroupIcon");
export const UserIcon = createAppIcon(HeroUserIcon, "UserIcon");
export const UserPlusIcon = createAppIcon(HeroUserPlusIcon, "UserPlusIcon");
export const UsersIcon = createAppIcon(HeroUsersIcon, "UsersIcon");
export const ViewColumnsIcon = createAppIcon(HeroViewColumnsIcon, "ViewColumnsIcon");
export const XCircleIcon = createAppIcon(HeroXCircleIcon, "XCircleIcon");
export const XMarkIcon = createAppIcon(HeroXMarkIcon, "XMarkIcon");
