/**
 * The dashboard's single icon source. UI glyphs come from the Pikaicons free set,
 * exposed under the names the code already used, so call sites stay readable.
 * The free set has no text-formatting, spinner, grip or plain-tick glyphs; those few
 * fall back to Lucide at the bottom of this file and nowhere else.
 */
import { forwardRef, type SVGProps } from "react";
import { PikaIcon, type IconSvgElement } from "@pikaicons/react";
import * as P from "@pikaicons/core-free";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref" | "children"> & {
  size?: number | string;
  strokeWidth?: number | string;
};
export type IconComponent = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;
/** Kept so existing `type LucideIcon` imports keep compiling. */
export type LucideIcon = IconComponent;

function pika(icon: IconSvgElement, name: string): IconComponent {
  const C = forwardRef<SVGSVGElement, IconProps>(({ strokeWidth = 1.75, ...props }, ref) => (
    <PikaIcon ref={ref} icon={icon} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true} {...props} />
  ));
  C.displayName = name;
  return C;
}

// Navigation & objects
export const GaugeCircle = pika(P.GridDashboard02Icon, "Dashboard");
export const Inbox = pika(P.ChatIcon, "Inbox");
export const Receipt = pika(P.ClipboardCheckIcon, "Receipt");
export const Footprints = pika(P.MapIcon, "Trips");
export const Mountain = pika(P.FlagIcon, "Mountain");
export const CalendarCheck = pika(P.CalendarCheckIcon, "CalendarCheck");
export const CalendarDays = pika(P.CalendarIcon, "CalendarDays");
export const Package = pika(P.Package01Icon, "Package");
export const PackageOpen = pika(P.Package01Icon, "PackageOpen");
export const MapPinHouse = pika(P.MapPinIcon, "MapPinHouse");
export const MapPinCheck = pika(P.BookmarkIcon, "MapPinCheck");
export const Layers2 = pika(P.LayerThreeIcon, "Layers2");
export const Tag = pika(P.TagIcon, "Tag");
export const NotebookPen = pika(P.File02Icon, "NotebookPen");
export const Newspaper = pika(P.PencilEditSwooshIcon, "Newspaper");
export const CopyX = pika(P.LayerTwoIcon, "CopyX");
export const FolderTree = pika(P.FolderIcon, "FolderTree");
export const Image = pika(P.PhotoImageIcon, "Image");
export const ImageIcon = Image;
export const Images = Image;
export const ImagePlus = pika(P.PhotoImagePlusIcon, "ImagePlus");
export const Library = pika(P.FolderIcon, "Library");
export const Redo = pika(P.LinkSlantIcon, "Redirects");
export const Contact2 = pika(P.UserIcon, "Contact2");
export const Building2 = pika(P.BuildingApartmentTwoIcon, "Building2");
export const PenLine = pika(P.PencilEditIcon, "PenLine");
export const Pencil = PenLine;
export const Quote = pika(P.UserLoveHeartIcon, "Testimonials");
export const Star = pika(P.StarIcon, "Star");
export const StarOff = Star;
export const FileText = pika(P.File02Icon, "FileText");
export const FilePlus2 = pika(P.FileIcon, "FilePlus2");
export const Mail = pika(P.EnvelopeIcon, "Mail");
export const MailCheck = Mail;
export const MailX = pika(P.NotificationBellOffIcon, "MailX");
export const Settings = pika(P.Settings01Icon, "Settings");
export const Users2 = pika(P.UserCircleIcon, "Users2");
export const UserPlus = pika(P.UserPlusIcon, "UserPlus");
export const UserCheck = pika(P.UserIcon, "UserCheck");
export const UserX = pika(P.UserIcon, "UserX");
export const KeyRound = pika(P.KeyLeftIcon, "KeyRound");
export const CreditCard = pika(P.CreditCardIcon, "CreditCard");
export const LifeBuoy = pika(P.HeadphonesIcon, "Support");
export const Globe = pika(P.GlobeIcon, "Globe");
export const ShieldCheck = pika(P.ShieldCheckIcon, "ShieldCheck");
export const Code = pika(P.CodeIcon, "Code");
export const Clock = pika(P.ClockIcon, "Clock");
export const Phone = pika(P.PhoneIcon, "Phone");
export const MessageCircle = pika(P.WhatsappIcon, "WhatsApp");
export const Moon = pika(P.MoonIcon, "Moon");
export const Sun = pika(P.SunIcon, "Sun");

// Actions
export const Plus = pika(P.PlusIcon, "Plus");
export const Search = pika(P.SearchIcon, "Search");
export const SearchIcon = Search;
export const SearchX = Search;
export const Upload = pika(P.UploadUpIcon, "Upload");
export const Save = pika(P.FloppyIcon, "Save");
export const Send = pika(P.SendPlaneHorizontalIcon, "Send");
export const Copy = pika(P.CopyIcon, "Copy");
export const Trash2 = pika(P.DeleteDustbin01Icon, "Trash2");
export const ExternalLink = pika(P.ExternalLinkSquareIcon, "ExternalLink");
export const Link2 = pika(P.LinkChainHorizontalIcon, "Link2");
export const LogOut = pika(P.LogOutRightIcon, "LogOut");
export const EyeOff = pika(P.EyeOffIcon, "EyeOff");
export const RefreshCw = pika(P.RefreshIcon, "RefreshCw");
export const RotateCcw = RefreshCw;
export const Power = pika(P.ToggleOnIcon, "Power");
export const MoreHorizontal = pika(P.ThreeDotsMenuHorizontalIcon, "MoreHorizontal");
export const PanelLeftIcon = pika(P.SidebarMenuIcon, "PanelLeft");

// Direction
export const ArrowDown = pika(P.ArrowDownIcon, "ArrowDown");
export const ArrowUp = pika(P.ArrowUpIcon, "ArrowUp");
export const ArrowLeft = pika(P.ArrowLeftIcon, "ArrowLeft");
export const ArrowRight = pika(P.ArrowRightIcon, "ArrowRight");
export const ChevronDown = pika(P.ChevronDownIcon, "ChevronDown");
export const ChevronDownIcon = ChevronDown;
export const ChevronUpIcon = pika(P.ChevronUpIcon, "ChevronUp");
export const ChevronLeft = pika(P.ChevronLeftIcon, "ChevronLeft");
export const ChevronRight = pika(P.ChevronRightIcon, "ChevronRight");
export const ChevronRightIcon = ChevronRight;

// Status
export const CheckCircle2 = pika(P.CheckTickCircleIcon, "CheckCircle2");
export const CircleCheckBig = CheckCircle2;
export const CircleCheckIcon = CheckCircle2;
export const CircleAlert = pika(P.AlertCircleIcon, "CircleAlert");
export const Info = pika(P.InformationCircleIcon, "Info");
export const InfoIcon = Info;
export const TriangleAlert = pika(P.AlertTriangleIcon, "TriangleAlert");
export const TriangleAlertIcon = TriangleAlert;
export const OctagonXIcon = pika(P.MultipleCrossCancelCircleIcon, "OctagonX");
export const XCircle = OctagonXIcon;
export const X = pika(P.MultipleCrossCancelIcon, "X");
export const XIcon = X;

// Glyphs the free Pikaicons set does not draw.
export {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  CheckIcon,
  ChevronsUpDown,
  CircleIcon,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Loader2Icon,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
export { Quote as QuoteGlyph } from "lucide-react";
