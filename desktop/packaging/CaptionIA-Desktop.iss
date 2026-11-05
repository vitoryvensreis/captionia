#define AppName "Caption IA Desktop"
#define AppVersion "1.1.0-beta.1"
#define AppPublisher "Caption IA"
#define AppExe "CaptionIA-Desktop.exe"

[Setup]
AppId={{9C7C4C21-8094-4FC8-B6DD-BA85177B2501}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Caption IA Desktop
DefaultGroupName=Caption IA Desktop
PrivilegesRequired=lowest
OutputDir=..\dist_installer
OutputBaseFilename=CaptionIA-Desktop-Setup-Windows-1.1.0-beta
SetupIconFile=..\assets\captionia.ico
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked

[Files]
Source: "..\dist\CaptionIA-Desktop\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Caption IA Desktop"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\Caption IA Desktop"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Abrir Caption IA Desktop"; Flags: nowait postinstall skipifsilent
